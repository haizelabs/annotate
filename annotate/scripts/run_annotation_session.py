#!/usr/bin/env python3
"""FastAPI server for test case state management.

Usage:
    python scripts/run_annotation_session.py \\
        --test-cases-dir .haize_annotations/test_cases \\
        --port 8000 # backend port
        --frontend-port 5173 # frontend port
"""
import argparse
import asyncio
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import time
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
import aiofiles

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ._models import (
    Interaction,
    FeedbackConfig,
    TestCaseStatus,
)
from ._test_case_processor import TestCaseProcessor
from ._test_case_collection import TestCaseCollection
from ._annotation_utils import compute_feedback_config_stats
from .api_models import (
    AnnotationRequest,
    AnnotationResponse,
    FeedbackConfigRequest,
    FeedbackConfigResponse,
    GetFeedbackConfigResponse,
    HealthResponse,
    NewTestCasesInfo,
    NextTestCaseResponse,
    StatusCounts,
    StatsResponse,
    VisualizeTestCaseResponse,
)

logger = logging.getLogger(__name__)

haize_annotations_dir: Optional[Path] = None
source_data_directory: Optional[Path] = None
collection: Optional[TestCaseCollection] = None
pipeline_worker: Optional[TestCaseProcessor] = None
pipeline_task: Optional[asyncio.Task] = None

feedback_config: Optional[FeedbackConfig] = None
frontend_process: Optional[subprocess.Popen] = None
frontend_port: int = 5173


@asynccontextmanager
async def lifespan(app: FastAPI):
    await refresh_on_startup_or_config_change()
    yield
    global pipeline_task, frontend_process

    if pipeline_task and not pipeline_task.done():
        pipeline_task.cancel()
        try:
            await pipeline_task
        except asyncio.CancelledError:
            pass

    if frontend_process and frontend_process.poll() is None:
        logger.info("\nShutting down frontend server...")
        frontend_process.terminate()
        try:
            frontend_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            frontend_process.kill()


app = FastAPI(title="Annotation Session API", lifespan=lifespan)

async def save_feedback_config():
    """Save feedback_config with updated stats to disk."""
    global feedback_config, haize_annotations_dir
    if feedback_config and haize_annotations_dir:
        feedback_config_path = haize_annotations_dir / "feedback_config.json"

        async def save_config():
            async with aiofiles.open(feedback_config_path, "w") as f:
                # Use model_dump with mode='json' to ensure proper serialization
                await f.write(
                    json.dumps(
                        feedback_config.model_dump(mode="json"), indent=2, default=str
                    )
                )

        await save_config()
        logger.info(f"✓ Updated feedback config stats: {feedback_config_path}")


def _archive_annotated_test_cases(old_config_id: str) -> int:
    global collection, haize_annotations_dir

    if not collection or not haize_annotations_dir:
        return 0

    all_test_cases = collection.list_test_cases()
    annotated_cases = [tc for tc in all_test_cases if tc.human_annotation is not None]

    if not annotated_cases:
        return 0

    archive_dir = haize_annotations_dir / "archived_annotations" / old_config_id
    archive_dir.mkdir(parents=True, exist_ok=True)

    archived_count = 0
    for tc in annotated_cases:
        tc_file = collection.dir / f"tc_{tc.test_case_id}.json"
        if tc_file.exists():
            archive_file = archive_dir / f"tc_{tc.test_case_id}.json"
            shutil.move(str(tc_file), str(archive_file))
            archived_count += 1

    logger.info(f"✓ Archived {archived_count} annotated test cases to {archive_dir}")
    return archived_count


async def refresh_on_startup_or_config_change() -> bool:
    global feedback_config, collection, pipeline_task, pipeline_worker

    if pipeline_task and not pipeline_task.done():
        logger.info("Stopping existing test case processor...")
        pipeline_task.cancel()
        try:
            await pipeline_task
        except asyncio.CancelledError:
            pass
        pipeline_task = None
        pipeline_worker = None

    if not haize_annotations_dir:
        return False

    feedback_config_path = haize_annotations_dir / "feedback_config.json"
    if not feedback_config_path.exists():
        logger.warning(
            "No feedback config found. Use POST /feedback-config to create one."
        )
        return False

    async with aiofiles.open(feedback_config_path) as f:
        content = await f.read()
        feedback_config = FeedbackConfig(**json.loads(content))
    logger.info(f"✓ Loaded feedback config: {feedback_config.id}")

    test_cases_dir = haize_annotations_dir / "test_cases"
    collection = TestCaseCollection(test_cases_dir, haize_annotations_dir)
    logger.info(f"✓ Initialized test case collection: {test_cases_dir}")

    if not collection.has_data():
        logger.warning("No ingested data available. Run ingestion first.")
        return False

    logger.info("Generating test cases for feedback config...")
    test_case_counts = _generate_test_cases_for_config(feedback_config)
    logger.info(f"✓ Test cases ready: {test_case_counts}")

    logger.info("Starting test case processor...")
    pipeline_worker = TestCaseProcessor(
        test_case_collection=collection,
        feedback_config=feedback_config,
        steps=collection.get_raw_judge_inputs("step"),
        interactions=collection.get_raw_judge_inputs("interaction"),
        groups=collection.get_raw_judge_inputs("group"),
        model_name="openai:gpt-5-nano",
    )
    pipeline_task = asyncio.create_task(
        pipeline_worker.run(
            poll_interval=5.0,
        )
    )
    logger.info("✓ test case processor started")
    return True


def _generate_test_cases_for_config(config: FeedbackConfig) -> dict[str, int]:
    global collection

    if not collection:
        raise ValueError("TestCaseCollection not initialized")

    raw_judge_inputs = collection.get_raw_judge_inputs(config.granularity)

    if not raw_judge_inputs:
        raise ValueError("No raw judge inputs to create test cases from")

    filtered_inputs = collection.filter_raw_judge_inputs(raw_judge_inputs, config)

    if not filtered_inputs:
        raise ValueError(
            "No raw judge inputs match the feedback config attribute matchers"
        )

    test_case_ids = collection.initialize_test_cases_for_config(
        raw_judge_inputs,
        config,
    )
    return {
        "pointwise": len(test_case_ids["pointwise"]),
        "ranking": len(test_case_ids["ranking"]),
        "filtered_inputs": len(filtered_inputs),
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        test_cases_dir=str(collection.dir) if collection else None,
    )


@app.post("/feedback-config", response_model=FeedbackConfigResponse)
async def create_or_update_feedback_config(
    request: FeedbackConfigRequest,
) -> FeedbackConfigResponse:
    """Create or update the active feedback configuration.

    This will:
    1. Archive existing annotated test cases if a config already exists
    2. Save the new config to disk
    3. Refresh the entire annotation session (load config, generate test cases, start pipeline)
    """
    global feedback_config, collection

    try:
        new_config = request.config
        archived_count = 0

        if feedback_config:
            logger.info(
                f"📦 Archiving test cases from old config: {feedback_config.id}"
            )
            archived_count = _archive_annotated_test_cases(feedback_config.id)

        feedback_config = new_config
        await save_feedback_config()

        test_cases_dir = haize_annotations_dir / "test_cases"
        temp_collection = TestCaseCollection(test_cases_dir, haize_annotations_dir)

        if temp_collection.has_data():
            raw_judge_inputs = temp_collection.get_raw_judge_inputs(
                feedback_config.granularity
            )
            if raw_judge_inputs:
                filtered_inputs = temp_collection.filter_raw_judge_inputs(
                    raw_judge_inputs, feedback_config
                )
                if not filtered_inputs:
                    raise HTTPException(
                        status_code=400,
                        detail="No raw judge inputs match the feedback config attribute matchers. Please adjust your configuration or ingest more data.",
                    )

        await refresh_on_startup_or_config_change()

        test_case_counts = NewTestCasesInfo(filtered_inputs=len(filtered_inputs))

        return FeedbackConfigResponse(
            status="success",
            config_id=new_config.id,
            archived_count=archived_count,
            new_test_cases=test_case_counts,
        )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to update config: {str(e)}"
        )


@app.get("/feedback-config", response_model=GetFeedbackConfigResponse)
async def get_feedback_config() -> GetFeedbackConfigResponse:
    """Get the active feedback configuration."""
    global feedback_config

    return GetFeedbackConfigResponse(config=feedback_config)


@app.get("/interaction/{step_id}")
async def get_interaction_for_step(step_id: str) -> Interaction:
    """Get the interaction for a specific step."""
    interaction_step = next(
        (step for step in collection._steps if step.id == step_id), None
    )
    if not interaction_step:
        raise HTTPException(status_code=404, detail="Step not found")
    interaction = next(
        (
            interaction
            for interaction in collection._interactions
            if interaction.id == interaction_step.interaction_id
        ),
        None,
    )
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction.model_dump(mode="json")


@app.get("/test-cases/{test_case_id}")
async def get_test_case(test_case_id: str):
    """Get specific test case by ID."""
    try:
        tc = collection.get_test_case(test_case_id)
        return tc.model_dump(mode="json")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/test-cases/next", response_model=NextTestCaseResponse)
async def get_next_test_case() -> NextTestCaseResponse:
    """Get the next test case that needs human annotation.

    Returns the oldest `ai_annotated` test case.

    Treat this as a dice roll for test case (s) to present to the user
    if they have no particular preference on what they want to see.

    Otherwise, feel free to do more targeted scans of test cases directory
    or use the search endpoint.
    """
    ai_annotated = collection.get_by_status(TestCaseStatus.AI_ANNOTATED)

    if not ai_annotated:
        return NextTestCaseResponse(
            test_case=None,
            remaining=0,
            message="No test cases ready for annotation",
        )

    ai_annotated.sort(key=lambda tc: tc.created_at)
    next_tc = ai_annotated[0]

    return NextTestCaseResponse(
        test_case=next_tc,
        remaining=len(ai_annotated) - 1,
    )


@app.post(
    "/api/test-cases/{test_case_id}/visualize", response_model=VisualizeTestCaseResponse
)
async def visualize_test_case_for_human(test_case_id: str) -> VisualizeTestCaseResponse:
    """Open test case in browser"""
    try:
        collection.get_test_case(test_case_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Test case not found")

    frontend_url = f"http://localhost:{frontend_port}"
    trace_url = f"{frontend_url}/test-cases/view/{test_case_id}/trace"
    try:
        webbrowser.open(trace_url)
        return VisualizeTestCaseResponse(
            success=True, url=trace_url, message="Opened in browser"
        )
    except Exception as e:
        return VisualizeTestCaseResponse(
            success=False,
            error=str(e),
            url=trace_url,
            message="Failed to open browser, but you can manually open the URL",
        )


@app.post(
    "/test_cases/{test_case_id}/annotate/human", response_model=AnnotationResponse
)
async def add_human_annotation(
    test_case_id: str, request: AnnotationRequest
) -> AnnotationResponse:
    """Add human annotation to test case."""
    try:
        collection.update_human_annotation(test_case_id, request.annotation)
        return AnnotationResponse(success=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/stats", response_model=StatsResponse)
async def get_stats() -> StatsResponse:
    """Get annotation progress statistics with comprehensive AI judge performance metrics."""
    counts = collection.count_by_status()

    comprehensive_stats = None
    if feedback_config:
        all_test_cases = collection.list_test_cases()
        comprehensive_stats = compute_feedback_config_stats(
            all_test_cases, feedback_config.feedback_spec
        )

    return StatsResponse(
        status_counts=StatusCounts(**counts),
        comprehensive_stats=comprehensive_stats,
    )


def main():
    parser = argparse.ArgumentParser(description="Run annotation session API server")
    parser.add_argument(
        "--haize-annotations-dir",
        required=True,
        help="Haize annotations directory. Will be created if doesn't exist",
    )
    parser.add_argument(
        "--source-data-directory",
        required=True,
        help="Source directory containing the raw data",
    )
    parser.add_argument(
        "--port", type=int, required=True, help="Port to start the annotation server"
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=5173,
        help="Port for frontend dev server (default: 5173)",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Skip starting the frontend dev server",
    )
    args = parser.parse_args()

    global haize_annotations_dir, source_data_directory, collection, feedback_config, frontend_port

    haize_annotations_dir = Path(args.haize_annotations_dir)
    source_data_directory = Path(args.source_data_directory)
    frontend_port = args.frontend_port

    haize_annotations_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"✓ Haize annotations directory: {haize_annotations_dir}")

    global frontend_process
    if not args.skip_frontend:
        script_dir = Path(__file__).resolve().parent
        frontend_dir = script_dir.parent / "frontend"
        if not frontend_dir.exists():
            logger.error(f"Error: Frontend directory not found at {frontend_dir}")
            logger.info("   Use --skip-frontend to start without frontend")
            sys.exit(1)

        logger.info("\n🎨 Starting frontend dev server...")

        node_modules = frontend_dir / "node_modules"
        if not node_modules.exists():
            logger.info("📦 Installing frontend dependencies (first time only)...")
            install_result = subprocess.run(
                ["npm", "install"], cwd=frontend_dir, capture_output=True, text=True
            )
            if install_result.returncode != 0:
                logger.error("Error: npm install failed:")
                logger.info(install_result.stderr)
                logger.info("   Use --skip-frontend to start without frontend")
                sys.exit(1)
            logger.info("✓ Frontend dependencies installed")

        try:
            frontend_env = os.environ.copy()
            frontend_env["VITE_BACKEND_URL"] = f"http://localhost:{args.port}"
            frontend_process = subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", str(args.frontend_port)],
                cwd=frontend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=frontend_env,
            )
            logger.info(f"✓ Frontend server starting on port {args.frontend_port}")
            print(
                f"✓ Frontend configured to connect to backend at http://localhost:{args.port}"
            )
            time.sleep(1)

            if frontend_process.poll() is not None:
                _stdout, stderr = frontend_process.communicate()
                logger.error("Error: Frontend process exited unexpectedly")
                if stderr:
                    logger.error(f"   Error output: {stderr}")
                sys.exit(1)
        except FileNotFoundError:
            logger.error("Error: npm not found. Please install Node.js.")
            logger.info("   Use --skip-frontend to start without frontend")
            sys.exit(1)

    def signal_handler(_sig, _frame):
        logger.info("\n\nReceived shutdown signal...")
        if frontend_process and frontend_process.poll() is None:
            logger.info("Shutting down frontend server...")
            frontend_process.terminate()
            try:
                frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_process.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    frontend_url = f"http://localhost:{args.frontend_port}"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info("\n" + "=" * 70)
    logger.info("ANNOTATION SESSION SERVERS STARTED")
    logger.info("=" * 70)
    logger.info("\nBACKEND API:")
    logger.info(f"   URL: http://localhost:{args.port}")
    logger.info(f"   Health: http://localhost:{args.port}/health")
    logger.info(f"   Haize Annotations: {haize_annotations_dir}")

    if not args.skip_frontend and frontend_process:
        logger.info("\n FRONTEND UI:")
        logger.info(f"   URL: http://localhost:{args.frontend_port}")
    elif args.skip_frontend:
        logger.warning("\nFrontend auto-start skipped (--skip-frontend flag)")
    else:
        logger.error("\nFrontend not available (failed to start)")

    logger.info("Press Ctrl+C to stop both servers")
    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
