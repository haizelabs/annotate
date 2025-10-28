"""API-specific models for the annotation server."""

from typing import Optional
from pydantic import BaseModel, Field

from ._models import (
    PointwiseAnnotationTestCase,
    RankingAnnotationTestCase,
    FeedbackConfig,
    FeedbackConfigStats,
    Annotation,
)


class AnnotationRequest(BaseModel):
    """Submit a human annotation for a test case."""

    annotation: Annotation = Field(
        ...,
        description="Annotation to submit. Type depends on the feedback spec: categorical (labels), continuous (scores), or ranking (ordering).",
    )


class FeedbackConfigRequest(BaseModel):
    """Create or update the active feedback configuration."""

    config: FeedbackConfig = Field(
        ...,
        description="Complete FeedbackConfig object defining evaluation criteria, granularity, rubrics, and filtering rules.",
    )


class HealthResponse(BaseModel):
    """Response from the health check endpoint."""

    status: str = Field(description="Health status of the server")
    test_cases_dir: Optional[str] = Field(
        default=None,
        description="Directory where test cases are stored, if collection is initialized",
    )


class NewTestCasesInfo(BaseModel):
    """Information about newly generated test cases."""

    filtered_inputs: int = Field(
        description="Number of inputs filtered out by attribute matchers"
    )


class FeedbackConfigResponse(BaseModel):
    """Response from creating or updating feedback config."""

    status: str = Field(description="Status of the operation")
    config_id: str = Field(description="ID of the feedback config")
    archived_count: int = Field(
        description="Number of test cases archived from previous config"
    )
    new_test_cases: NewTestCasesInfo = Field(
        description="Information about newly generated test cases"
    )


class GetFeedbackConfigResponse(BaseModel):
    """Response from getting the current feedback config."""

    config: Optional[FeedbackConfig] = Field(
        default=None,
        description="Current feedback config, None if no config is set",
    )


class NextTestCaseResponse(BaseModel):
    """Response from getting the next test case to annotate."""

    test_case: Optional[PointwiseAnnotationTestCase | RankingAnnotationTestCase] = (
        Field(
            default=None,
            description="Next test case to annotate, None if no test cases available",
        )
    )
    remaining: int = Field(description="Number of remaining test cases to annotate")
    message: Optional[str] = Field(
        default=None,
        description="Optional message when no test cases are available",
    )


class VisualizeTestCaseResponse(BaseModel):
    """Response from visualizing a test case."""

    success: bool = Field(description="Whether visualization succeeded")
    url: str = Field(description="URL where the test case was opened")
    message: str = Field(description="Human-readable message about the operation")
    error: Optional[str] = Field(
        default=None,
        description="Error message if visualization failed",
    )


class AnnotationResponse(BaseModel):
    """Response from submitting an annotation."""

    success: bool = Field(description="Whether the annotation was successfully added")


class StatusCounts(BaseModel):
    """Counts of test cases by status."""

    pending: int = Field(description="Number of test cases in pending state")
    summarized: int = Field(description="Number of test cases in summarized state")
    ai_annotated: int = Field(description="Number of test cases with AI annotations")
    human_annotated: int = Field(
        description="Number of test cases with human annotations"
    )
    invalid: int = Field(description="Number of invalid test cases")


class StatsResponse(BaseModel):
    """Get annotation progress stats and ai/human agreement metrics."""

    status_counts: StatusCounts = Field(description="Counts of test cases by status")
    comprehensive_stats: Optional[FeedbackConfigStats] = Field(
        default=None,
        description="Detailed statistics about AI vs human annotations, None if no feedback config is set",
    )
