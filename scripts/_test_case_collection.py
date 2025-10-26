"""Manages test cases as the single source of truth for annotation workflow."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from ._models import FeedbackConfig
from ._models import (
    JudgeInput,
    Annotation,
    TestCase,
    TestCaseStatus,
    PointwiseAnnotationTestCase,
    RankingAnnotationTestCase,
    RawJudgeInput,
)
from itertools import combinations
from ._models import RankingSpec
import logfire
from ._interaction_utils import (
    build_interaction_objects,
    build_interaction_groups,
)
from ._models import Interaction, InteractionStep, InteractionGroup


MAX_TEST_CASES = 100


class TestCaseCollection:
    """Manages test cases stored as individual JSON files."""

    def __init__(
        self,
        test_cases_dir: Path | str,
        haize_annotations_dir: Path | str | None = None,
    ):
        self.dir = Path(test_cases_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.haize_annotations_dir = (
            Path(haize_annotations_dir) if haize_annotations_dir else None
        )
        self._steps: list[InteractionStep] = []
        self._interactions: list[Interaction] = []
        self._groups: list[InteractionGroup] = []
        self._data_loaded = False

    def load_ingested_data(self) -> bool:
        """Load ingested data from the ingested_data directory."""

        if not self.haize_annotations_dir:
            return False

        ingested_data_dir = (
            self.haize_annotations_dir / "ingested_data" / "interactions"
        )
        if not ingested_data_dir.exists():
            print(f"Ingested data directory not found at {ingested_data_dir}")
            return False

        print(f"📂 Loading ingested data from {ingested_data_dir}")
        steps_list = []
        for interaction_dir in ingested_data_dir.iterdir():
            if interaction_dir.is_dir():
                try:
                    interaction = Interaction.load(str(interaction_dir))
                    steps_list.extend(interaction.steps)
                except Exception as e:
                    print(f"⚠️  Warning: Could not load {interaction_dir.name}: {e}")

        if steps_list:
            self._steps = steps_list
            self._interactions = build_interaction_objects(steps_list)
            self._groups = build_interaction_groups(steps_list)
            self._data_loaded = True
            print(
                f"✓ Loaded {len(self._steps)} steps, {len(self._interactions)} interactions, {len(self._groups)} groups"
            )
            return True
        else:
            print("⚠️  No steps loaded from ingested data")
            return False

    def get_raw_judge_inputs(self, granularity: str) -> list:
        """Get raw judge inputs based on granularity.

        Args:
            granularity: "step", "interaction", or "group"

        Returns:
            List of raw judge inputs for the specified granularity
        """
        if not self._data_loaded:
            self.load_ingested_data()

        if granularity == "step":
            return self._steps
        elif granularity == "interaction":
            return self._interactions
        elif granularity == "group":
            return self._groups
        else:
            raise ValueError(f"Unknown granularity: {granularity}")

    def has_data(self) -> bool:
        """Check if ingested data is available."""
        if not self._data_loaded:
            self.load_ingested_data()
        return len(self._steps) > 0

    def _load_all(self) -> list[TestCase]:
        """Load all test cases from directory, limited to MAX_TEST_CASES for memory management."""
        test_cases = []
        tc_files = sorted(self.dir.glob("tc_*.json"))

        if len(tc_files) > MAX_TEST_CASES:
            print(
                f"⚠️  Found {len(tc_files)} test cases, loading only first {MAX_TEST_CASES} for memory management"
            )
            tc_files = tc_files[:MAX_TEST_CASES]

        for tc_file in tc_files:
            test_cases.append(self._load_file(tc_file))
        return test_cases

    def _load_file(self, tc_file: Path) -> TestCase:
        """Load single test case file."""
        tc_data = json.loads(tc_file.read_text())
        if tc_data.get("test_case_type") == "pointwise":
            return PointwiseAnnotationTestCase(**tc_data)
        elif tc_data.get("test_case_type") == "ranking":
            return RankingAnnotationTestCase(**tc_data)
        raise ValueError(f"Unknown test case type in {tc_file}")

    def get_test_case(self, test_case_id: str) -> TestCase:
        """Get single test case by ID."""
        tc_file = self.dir / f"tc_{test_case_id}.json"
        if not tc_file.exists():
            raise ValueError(f"Test case not found: {test_case_id}")
        return self._load_file(tc_file)

    def save_test_case(self, test_case: TestCase) -> None:
        """Save test case to file."""
        tc_file = self.dir / f"tc_{test_case.test_case_id}.json"
        data = test_case.model_dump(mode="json")
        if isinstance(test_case, PointwiseAnnotationTestCase):
            data["test_case_type"] = "pointwise"
        elif isinstance(test_case, RankingAnnotationTestCase):
            data["test_case_type"] = "ranking"
        tc_file.write_text(json.dumps(data, indent=2, default=str))

    def list_test_cases(
        self,
        status: Optional[TestCaseStatus] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[TestCase]:
        """List test cases with optional filtering."""
        # TODO: don't load all test cases into memory
        all_cases = self._load_all()
        if status:
            all_cases = [tc for tc in all_cases if tc.status == status]
        return all_cases[offset : offset + limit] if limit else all_cases[offset:]

    def create_all_pointwise_test_cases(
        self,
        raw_judge_inputs: list[RawJudgeInput],
        granularity: str,
        feedback_config,
    ) -> list[str]:
        test_case_ids = []
        limited_inputs = raw_judge_inputs[:MAX_TEST_CASES]
        if len(raw_judge_inputs) > MAX_TEST_CASES:
            print(
                f"⚠️  Limiting pointwise test case creation to {MAX_TEST_CASES} (from {len(raw_judge_inputs)} inputs)"
            )

        for raw_input in limited_inputs:
            test_case = PointwiseAnnotationTestCase(
                feedback_config=feedback_config,
                granularity=granularity,
                raw_judge_input=raw_input,
                status=TestCaseStatus.PENDING,
            )
            self.save_test_case(test_case)
            test_case_ids.append(test_case.test_case_id)

        return test_case_ids

    def update_judge_input(
        self,
        test_case_id: str,
        judge_input: JudgeInput,
    ) -> None:
        """Add summarized judge input to pointwise test case."""
        tc = self.get_test_case(test_case_id)
        if not isinstance(tc, PointwiseAnnotationTestCase):
            raise ValueError(f"Test case {test_case_id} is not a pointwise test case")
        tc.judge_input = judge_input
        tc.status = TestCaseStatus.SUMMARIZED
        tc.updated_at = datetime.now(timezone.utc)
        self.save_test_case(tc)

    def update_judge_inputs(
        self,
        test_case_id: str,
        judge_inputs: list[JudgeInput],
    ) -> None:
        """Add summarized judge inputs to ranking test case."""
        tc = self.get_test_case(test_case_id)
        if not isinstance(tc, RankingAnnotationTestCase):
            raise ValueError(f"Test case {test_case_id} is not a ranking test case")
        tc.judge_inputs = judge_inputs
        tc.status = TestCaseStatus.SUMMARIZED
        tc.updated_at = datetime.now(timezone.utc)
        self.save_test_case(tc)

    def update_ai_annotation(
        self,
        test_case_id: str,
        ai_annotation: Annotation,
    ) -> None:
        """Add AI judge annotation to test case."""
        tc = self.get_test_case(test_case_id)
        tc.ai_annotation = ai_annotation
        if tc.status != TestCaseStatus.HUMAN_ANNOTATED:
            tc.status = TestCaseStatus.AI_ANNOTATED
        tc.updated_at = datetime.now(timezone.utc)
        self.save_test_case(tc)

    def update_human_annotation(
        self,
        test_case_id: str,
        human_annotation: Annotation,
    ) -> None:
        """Add human annotation to test case."""
        tc = self.get_test_case(test_case_id)
        tc.human_annotation = human_annotation
        tc.status = TestCaseStatus.HUMAN_ANNOTATED
        tc.updated_at = datetime.now(timezone.utc)
        self.save_test_case(tc)

    def get_by_status(self, status: TestCaseStatus) -> list[TestCase]:
        """Get all test cases with a specific status."""
        test_cases = self.list_test_cases(status=status)
        return test_cases

    def count_by_status(self) -> dict[str, int]:
        """Get count of test cases by status."""
        all_cases = self._load_all()
        counts: dict[str, int] = {
            TestCaseStatus.PENDING: 0,
            TestCaseStatus.SUMMARIZED: 0,
            TestCaseStatus.AI_ANNOTATED: 0,
            TestCaseStatus.HUMAN_ANNOTATED: 0,
            TestCaseStatus.INVALID: 0,
        }
        for tc in all_cases:
            status = tc.status
            if status in counts:
                counts[status] += 1
        return counts

    def create_ranking_test_cases(
        self,
        raw_judge_inputs: list[RawJudgeInput],
        comparison_items: int,
        feedback_config,
    ) -> list[str]:
        combos = list(combinations(raw_judge_inputs, comparison_items))

        limited_combos = combos[:MAX_TEST_CASES]
        if len(combos) > MAX_TEST_CASES:
            print(
                f"⚠️  Limiting ranking test case creation to {MAX_TEST_CASES} (from {len(combos)} combinations)"
            )

        test_case_ids = []
        for combo in limited_combos:
            test_case = RankingAnnotationTestCase(
                granularity=feedback_config.granularity,
                feedback_config=feedback_config,
                comparison_items=comparison_items,
                raw_judge_inputs=combo,
                status=TestCaseStatus.PENDING,
            )
            self.save_test_case(test_case)
            test_case_ids.append(test_case.test_case_id)

        return test_case_ids

    def get_pointwise_test_cases(self) -> list[PointwiseAnnotationTestCase]:
        """Get all pointwise test cases, limited to MAX_TEST_CASES for memory management."""
        pointwise_files = []
        for tc_file in sorted(self.dir.glob("tc_*.json")):
            # Quick check of file content to see if it's pointwise without loading full object
            tc_data = json.loads(tc_file.read_text())
            if tc_data.get("test_case_type") == "pointwise":
                pointwise_files.append(tc_file)
                if len(pointwise_files) >= MAX_TEST_CASES:
                    break

        if len(pointwise_files) > MAX_TEST_CASES:
            print(
                f"⚠️  Found {len(pointwise_files)} pointwise test cases, loading only first {MAX_TEST_CASES} for memory management"
            )
            pointwise_files = pointwise_files[:MAX_TEST_CASES]

        return [
            tc
            for tc in [self._load_file(tc_file) for tc_file in pointwise_files]
            if tc is not None
        ]

    def get_ranking_test_cases(self) -> list[RankingAnnotationTestCase]:
        """Get all ranking test cases, limited to MAX_TEST_CASES for memory management."""
        ranking_files = []
        for tc_file in sorted(self.dir.glob("tc_*.json")):
            # Quick check of file content to see if it's ranking without loading full object
            tc_data = json.loads(tc_file.read_text())
            if tc_data.get("test_case_type") == "ranking":
                ranking_files.append(tc_file)
                if len(ranking_files) >= MAX_TEST_CASES:
                    break

        if len(ranking_files) > MAX_TEST_CASES:
            print(
                f"⚠️  Found {len(ranking_files)} ranking test cases, loading only first {MAX_TEST_CASES} for memory management"
            )
            ranking_files = ranking_files[:MAX_TEST_CASES]

        return [self._load_file(tc_file) for tc_file in ranking_files]

    def get_test_cases_by_config(self, config_id: str) -> list[TestCase]:
        """Get all test cases for a specific config ID."""
        return [tc for tc in self._load_all() if tc.feedback_config.id == config_id]

    def _find(self, test_case_id: str) -> TestCase:
        """Internal method to find a test case by ID (for backward compatibility)."""
        return self.get_test_case(test_case_id)

    def get_pointwise_by_config(
        self, config_id: str
    ) -> list[PointwiseAnnotationTestCase]:
        """Get pointwise test cases for a specific config ID."""
        return [
            tc
            for tc in self.get_pointwise_test_cases()
            if tc.feedback_config.id == config_id
        ]

    def get_ranking_by_config(self, config_id: str) -> list[RankingAnnotationTestCase]:
        """Get ranking test cases for a specific config ID."""
        return [
            tc
            for tc in self.get_ranking_test_cases()
            if tc.feedback_config.id == config_id
        ]

    def get_status(self, test_case_id: str) -> TestCaseStatus:
        """Get the status of a test case."""
        tc = self.get_test_case(test_case_id)
        return tc.status

    def has_ai_annotation(self, test_case_id: str) -> bool:
        """Check if a test case has an AI annotation."""
        tc = self.get_test_case(test_case_id)
        return tc.ai_annotation is not None

    @logfire.instrument("mark_as_invalid")
    def mark_as_invalid(
        self, test_case_id: str, reason: str = "Required fields not available"
    ) -> None:
        """Mark a test case as invalid (skipped due to missing required fields)."""
        tc = self.get_test_case(test_case_id)
        tc.status = TestCaseStatus.INVALID
        tc.judge_inputs = None
        tc.updated_at = datetime.now(timezone.utc)
        self.save_test_case(tc)

    def filter_raw_judge_inputs(
        self,
        raw_judge_inputs: list[RawJudgeInput],
        feedback_config: FeedbackConfig,
    ) -> list[RawJudgeInput]:
        """Filter raw judge inputs based on feedback config attribute matchers.

        Args:
            raw_judge_inputs: List of raw judge inputs to filter
            feedback_config: Configuration containing attribute matchers

        Returns:
            List of filtered raw judge inputs that match all attribute matchers
        """
        if not feedback_config.attribute_matchers:
            return raw_judge_inputs

        filtered_inputs = []
        for raw_input in raw_judge_inputs:
            passes_all = all(
                matcher.matches(raw_input)
                for matcher in feedback_config.attribute_matchers
            )
            if passes_all:
                filtered_inputs.append(raw_input)

        return filtered_inputs

    def initialize_test_cases_for_config(
        self,
        raw_judge_inputs: list[RawJudgeInput],
        feedback_config,
    ) -> dict[str, list[str]]:
        existing_test_cases = self.get_test_cases_by_config(feedback_config.id)
        if len(existing_test_cases) > 0:
            pointwise = [
                tc.test_case_id
                for tc in existing_test_cases
                if isinstance(tc, PointwiseAnnotationTestCase)
            ]
            ranking = [
                tc.test_case_id
                for tc in existing_test_cases
                if isinstance(tc, RankingAnnotationTestCase)
            ]
            return {"pointwise": pointwise, "ranking": ranking}

        filtered_inputs = self.filter_raw_judge_inputs(
            raw_judge_inputs, feedback_config
        )

        if isinstance(feedback_config.feedback_spec, RankingSpec):
            ranking_ids = self.create_ranking_test_cases(
                raw_judge_inputs=filtered_inputs,
                comparison_items=feedback_config.feedback_spec.comparison_items,
                feedback_config=feedback_config,
            )
            return {"pointwise": [], "ranking": ranking_ids}
        else:
            pointwise_ids = self.create_all_pointwise_test_cases(
                filtered_inputs,
                granularity=feedback_config.granularity,
                feedback_config=feedback_config,
            )
            return {"pointwise": pointwise_ids, "ranking": []}
