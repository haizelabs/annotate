"""Shared test case processor for processing test cases through summarization → AI annotation.

This module contains the core TestCaseProcessor logic extracted from annotation_loop.py
and can be used by both the CLI and the API server.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from typing import Union
from ._annotation_utils import summarize_for_judge_input, create_ai_annotation
from ._models import (
    PointwiseAnnotationTestCase,
    RankingAnnotationTestCase,
    TestCaseStatus,
    InteractionStep,
    Interaction,
    InteractionGroup,
)

if TYPE_CHECKING:
    from ._test_case_collection import TestCaseCollection
    from ._models import FeedbackConfig


class TestCaseProcessor:
    def __init__(
        self,
        test_case_collection: "TestCaseCollection",
        feedback_config: "FeedbackConfig",
        steps: list[InteractionStep],
        interactions: list[Interaction],
        groups: list[InteractionGroup],
    ):
        self.test_case_collection = test_case_collection
        self.feedback_config = feedback_config
        self.steps = steps
        self.interactions = interactions
        self.groups = groups
        self.error: Exception | None = None

    def get_context(
        self, test_case: PointwiseAnnotationTestCase | RankingAnnotationTestCase
    ) -> Union[Interaction, InteractionGroup, None]:
        if self.feedback_config.requires_context == "interaction":
            return next(
                (
                    interaction
                    for interaction in self.interactions
                    if interaction.id == test_case.raw_judge_input.interaction_id
                ),
                None,
            )
        elif self.feedback_config.requires_context == "group":
            return next(
                (
                    group
                    for group in self.groups
                    if group.id == test_case.raw_judge_input.group_id
                ),
                None,
            )
        else:
            return None

    async def process_batch(
        self,
        test_cases: list[PointwiseAnnotationTestCase | RankingAnnotationTestCase],
        max_concurrent: int = 20,
    ) -> dict[str, str]:
        results = {}

        async def process_single(
            tc: PointwiseAnnotationTestCase | RankingAnnotationTestCase,
        ) -> None:
            try:
                if isinstance(tc, RankingAnnotationTestCase) and not tc.judge_inputs:
                    judge_inputs = []
                    for raw_judge_input in tc.raw_judge_inputs:
                        judge_input = await summarize_for_judge_input(
                            input_items=self.feedback_config.input_items,
                            raw_input=raw_judge_input,
                            raw_input_context=self.get_context(tc),
                            attribute_matchers=self.feedback_config.attribute_matchers,
                            natural_language_disqualifier=self.feedback_config.natural_language_disqualifier,
                        )
                        judge_inputs.append(judge_input)
                    if any(j is None for j in judge_inputs):
                        self.test_case_collection.mark_as_invalid(
                            tc.test_case_id,
                            reason="Disqualified during judge input extraction",
                        )
                        results[tc.test_case_id] = "invalid"
                        return
                    self.test_case_collection.update_judge_inputs(
                        tc.test_case_id, judge_inputs
                    )
                    tc.judge_inputs = judge_inputs

                elif isinstance(tc, PointwiseAnnotationTestCase) and not tc.judge_input:
                    judge_input = await summarize_for_judge_input(
                        input_items=self.feedback_config.input_items,
                        raw_input=tc.raw_judge_input,
                        raw_input_context=self.get_context(tc),
                        attribute_matchers=self.feedback_config.attribute_matchers,
                        natural_language_disqualifier=self.feedback_config.natural_language_disqualifier,
                    )
                    if judge_input is None:
                        self.test_case_collection.mark_as_invalid(
                            tc.test_case_id,
                            reason="Disqualified during judge input extraction",
                        )
                        results[tc.test_case_id] = "invalid"
                        return

                    self.test_case_collection.update_judge_input(
                        tc.test_case_id, judge_input
                    )
                    tc.judge_input = judge_input

                if not tc.ai_annotation:
                    ai_annotation = await create_ai_annotation(
                        judge_input=(
                            tc.judge_input
                            if isinstance(tc, PointwiseAnnotationTestCase)
                            else tc.judge_inputs
                        ),
                        feedback_spec=self.feedback_config.feedback_spec,
                        ai_rubric=self.feedback_config.ai_rubric,
                        test_case_id=tc.test_case_id,
                    )
                    self.test_case_collection.update_ai_annotation(
                        tc.test_case_id, ai_annotation
                    )

                results[tc.test_case_id] = "ai_annotated"

            except Exception as e:
                error_message = f"Error during processing: {str(e)[:200]}"
                self.test_case_collection.mark_as_invalid(
                    tc.test_case_id, reason=error_message
                )
                results[tc.test_case_id] = "invalid"

        for i in range(0, len(test_cases), max_concurrent):
            batch = test_cases[i : i + max_concurrent]
            await asyncio.gather(*[process_single(tc) for tc in batch])

        return results

    async def run(
        self,
        poll_interval: float = 5.0,
    ) -> None:
        while True:
            pending = self.test_case_collection.get_by_status(TestCaseStatus.PENDING)
            summarized = self.test_case_collection.get_by_status(
                TestCaseStatus.SUMMARIZED
            )
            all_to_process = summarized + pending

            if all_to_process:
                await self.process_batch(all_to_process)

            await asyncio.sleep(poll_interval)
