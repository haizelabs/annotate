from __future__ import annotations
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import os
from enum import Enum
from typing import Optional, Union

from pydantic import Field, create_model, model_validator
from pydantic_ai import Agent

from ._models import (
    Annotation,
    AnnotationSpec,
    AttributeMatcher,
    CategoricalAnnotation,
    CategoricalPointwiseSpec,
    ContinuousAnnotation,
    ContinuousPointwiseSpec,
    FeedbackConfigStats,
    InputItem,
    InputItemValue,
    Interaction,
    InteractionGroup,
    InteractionStep,
    JudgeInput,
    RankingAnnotation,
    RankingSpec,
    Reference,
    TestCase,
    TestCaseStatus,
)

MODEL_NAME = os.getenv("HAIZE_ANNOTATE_MODEL_NAME", "openai:gpt-4.1")


def create_validated_reference_model(
    raw_input: Union[InteractionStep, Interaction, InteractionGroup],
) -> type[Reference]:
    """
    Create a Reference model that validates references exist in raw_input.

    Args:
        raw_input: The raw interaction data to validate against

    Returns:
        A Reference subclass with validation for the specific raw_input
    """
    valid_step_ids = set()
    valid_interaction_ids = set()
    valid_group_ids = set()

    if isinstance(raw_input, InteractionStep):
        valid_step_ids.add(raw_input.id)
    elif isinstance(raw_input, Interaction):
        valid_interaction_ids.add(raw_input.id)
        for step in raw_input.steps:
            valid_step_ids.add(step.id)
    elif isinstance(raw_input, InteractionGroup):
        valid_group_ids.add(raw_input.id)
        for interaction in raw_input.interactions:
            valid_interaction_ids.add(interaction.id)
            for step in interaction.steps:
                valid_step_ids.add(step.id)

    class ValidatedReference(Reference):
        @model_validator(mode="after")
        def validate_id_exists(self) -> "ValidatedReference":
            if self.type == "step" and self.id not in valid_step_ids:
                raise ValueError(
                    f"Reference to step '{self.id}' not found in raw_input. "
                    f"Valid step IDs: {valid_step_ids}"
                )
            elif self.type == "interaction" and self.id not in valid_interaction_ids:
                raise ValueError(
                    f"Reference to interaction '{self.id}' not found in raw_input. "
                    f"Valid interaction IDs: {valid_interaction_ids}"
                )
            elif self.type == "group" and self.id not in valid_group_ids:
                raise ValueError(
                    f"Reference to group '{self.id}' not found in raw_input. "
                    f"Valid group IDs: {valid_group_ids}"
                )
            return self

    return ValidatedReference


async def summarize_for_judge_input(
    input_items: list[InputItem],
    raw_input: Union[InteractionStep, Interaction, InteractionGroup],
    raw_input_context: Union[Interaction, InteractionGroup, None] = None,
    model_name: Optional[str] = None,
    attribute_matchers: list[AttributeMatcher] | None = None,
    natural_language_disqualifier: Optional[str] = None,
) -> JudgeInput | None:
    if model_name is None:
        model_name = MODEL_NAME

    if attribute_matchers:
        for matcher in attribute_matchers:
            matches = matcher.matches(raw_input)
            if not matches:
                return None

    ValidatedReference = create_validated_reference_model(raw_input)

    field_definitions = {}
    for item in input_items:
        FieldModel = create_model(
            f"{item.name}_extraction",
            value=(str | None, Field(description=item.description)),
            references=(
                list[ValidatedReference],
                Field(
                    description="List of references citing where this value came from"
                ),
            ),
        )
        field_definitions[item.name] = (FieldModel, Field(...))

    field_definitions["disqualified"] = (
        bool,
        Field(
            description="Whether this test case should be disqualified from evaluation"
        ),
    )

    ExtractionModel = create_model("InputExtraction", **field_definitions)

    agent = Agent(model_name, output_type=ExtractionModel)

    input_json = json.dumps(raw_input.model_dump(mode="json"), indent=2)
    raw_input_schema = raw_input.__class__.model_json_schema()
    field_descriptions = "\n".join(
        f"- {item.name}: {item.description}" for item in input_items
    )

    context_section = ""
    if raw_input_context:
        context_json = raw_input_context.model_dump_json()
        context_section = f"""
Additional context:
{context_json}

Use this context to help extract information from the raw input when needed.
For example, if the raw input is a single step, the context might provide information
about other steps surrounding the step in the same interaction.
"""
    disqualification_section = ""
    if natural_language_disqualifier:
        disqualification_section = f"""

Here is some criteria for when you should just not attempt a extaction and ignore this test case since it isn't relevant.
{natural_language_disqualifier}

IMPORTANT: Only mark disqualified=true if the raw input is not relevant to the evaluation task.
Be generous in your interpretation - when in doubt, include the test case rather than exclude it.
There be one final step of filtering (the ai annotator) after this, so don't worry about skipping too many test cases.
"""
    prompt = f"""
You are extracting information from an AI interaction to show to a human annotator.
The extracted information should be easy for anyone, including non-technical users, to understand.
Yet, it must remain technically accurate and faithful to the original raw data.

The raw input is represented as a {raw_input.__class__.__name__} object and structured
as follows: {raw_input_schema}

The smallest unit of this raw data is a step; interactions are groups of steps; and groups are collections of interactions.

Extract ONE set of judge inputs from this raw data according to the following schema:
{ExtractionModel.model_json_schema()}

In particular, extract the following fields:
{field_descriptions}

For EACH field, return:
1. value: the extracted/summarized value (string or null if not available)
2. references: where in the original raw data this value was sourced from
   The references should be in this format:
   - type: "step", "interaction", or "group"
   - id: the ID of the step/interaction/group
   - field: (optional) specific field path if the data was sourced from a particular field

Additionally, return:
3. disqualified: true if this entire test case should be disqualified from evaluation, false otherwise

The summary must be AS human readable as possible - so don't be aprove to add some newlines, header sections, etc to make it more readable.

{disqualification_section}
Example references:
- {{"type": "step", "id": "step-123", "field": "output_data.answer"}}
- {{"type": "interaction", "id": "interaction-123"}}

IMPORTANT: Make a clear binary decision about disqualification. If the test case is disqualified=true,
it will be skipped entirely. If disqualified=false, extract whatever data is available (even if some fields are null).
Missing data in individual fields does NOT mean the test case should be disqualified.

Here is the additional context in which this particular raw input is situated in
<context_section>
{context_section}
</context_section>

Here is the raw input data to extract from:
<raw_input_data>
{input_json}
</raw_input_data>

Extract the judge inputs with proper citations.
"""

    extraction_result = await agent.run(prompt)
    extracted_data = extraction_result.output

    if hasattr(extracted_data, "disqualified") and extracted_data.disqualified:
        return None

    input_item_values = []
    for item in input_items:
        field_data = getattr(extracted_data, item.name, None)
        if field_data:
            value = field_data.value if field_data.value is not None else ""
            input_item_values.append(
                InputItemValue(
                    name=item.name,
                    description=item.description,
                    value=value,
                    references=field_data.references,
                )
            )
        else:
            input_item_values.append(
                InputItemValue(
                    name=item.name,
                    description=item.description,
                    value="",
                    references=[],
                )
            )

    if isinstance(raw_input, InteractionStep):
        source_type = "step"
        source_ids = [raw_input.id]
    elif isinstance(raw_input, Interaction):
        source_type = "interaction"
        source_ids = [raw_input.id]
    elif isinstance(raw_input, InteractionGroup):
        source_type = "group"
        source_ids = [raw_input.id]

    return JudgeInput(
        input_items=input_item_values,
        raw_input=raw_input,
        source_type=source_type,
        source_ids=source_ids,
    )


async def create_ai_annotation(
    judge_input: Union[JudgeInput, list[JudgeInput]],
    feedback_spec: Union[
        CategoricalPointwiseSpec, ContinuousPointwiseSpec, RankingSpec
    ],
    ai_rubric: str,
    test_case_id: str,
    model_name: Optional[str] = None,
) -> Annotation:
    """
    Create AI annotation using structured output and the provided rubric.

    Args:
        judge_input: The judge input containing extracted values
        feedback_spec: The feedback specification (categorical, continuous, or ranking)
        ai_rubric: The evaluation rubric/prompt for the AI judge
        test_case_id: The ID of the test case being annotated
        model_name: LLM model to use for evaluation

    Returns:
        Annotation with skip=True if evaluation is not applicable
    """
    if model_name is None:
        model_name = MODEL_NAME
    base_fields = {
        "skip": (
            bool,
            Field(
                description="Whether this test case should be skipped (e.g., not applicable for evaluation)"
            ),
        ),
        "comment": (
            str,
            Field(
                description="A comment from the annotator - e.g. why they skipped or annotated the test case a certain way"
            ),
        ),
    }
    if isinstance(feedback_spec, CategoricalPointwiseSpec):
        CategoryEnum = Enum(
            "CategoryEnum", {cat: cat for cat in feedback_spec.categories}
        )
        spec_fields = {
            "category": (
                CategoryEnum,
                Field(
                    description=f"Selected category from: {feedback_spec.categories}"
                ),
            ),
            "confidence": (
                float,
                Field(description="Confidence score from 0.0 to 1.0"),
            ),
            "reasoning": (
                str,
                Field(description="Brief explanation of the evaluation"),
            ),
        }
        EvaluationModel = create_model(
            "CategoricalEvaluation", **{**spec_fields, **base_fields}
        )
    elif isinstance(feedback_spec, ContinuousPointwiseSpec):
        min_score, max_score = feedback_spec.score_range
        spec_fields = {
            "score": (
                float,
                Field(description=f"Score from {min_score} to {max_score}"),
            ),
            "confidence": (
                float,
                Field(description="Confidence score from 0.0 to 1.0"),
            ),
            "reasoning": (
                str,
                Field(description="Brief explanation of the evaluation"),
            ),
        }
        EvaluationModel = create_model(
            "ContinuousEvaluation", **{**spec_fields, **base_fields}
        )
    elif isinstance(feedback_spec, RankingSpec):
        spec_fields = {
            "rankings": (
                list[int],
                Field(
                    description=f"Indices ranked from best to worst (0 to {feedback_spec.comparison_items - 1})"
                ),
            ),
        }
        EvaluationModel = create_model(
            "RankingEvaluation", **{**spec_fields, **base_fields}
        )

    agent = Agent(model_name, output_type=EvaluationModel)

    rubric_variables = {}
    if isinstance(judge_input, list):
        for idx, judge_inp in enumerate(judge_input):
            for item in judge_inp.input_items:
                rubric_variables[f"{item.name}_{idx}"] = item.value
    else:
        for item in judge_input.input_items:
            rubric_variables[item.name] = item.value

    try:
        formatted_rubric = ai_rubric.format(**rubric_variables)
    except KeyError as e:
        raise ValueError(
            f"Missing variable {e} in ai_rubric. Available variables: {list(rubric_variables.keys())}"
        )

    evaluation_result = await agent.run(formatted_rubric, output_type=EvaluationModel)
    evaluation: EvaluationModel = evaluation_result.output

    if isinstance(feedback_spec, RankingSpec):
        expected_indices = set(range(feedback_spec.comparison_items))
        provided_indices = set(evaluation.rankings)

        if provided_indices != expected_indices:
            raise ValueError(
                f"Invalid rankings: expected indices {expected_indices}, got {provided_indices}"
            )

        if len(evaluation.rankings) != feedback_spec.comparison_items:
            raise ValueError(
                f"Invalid rankings length: expected {feedback_spec.comparison_items}, got {len(evaluation.rankings)}"
            )

    if evaluation.skip:
        if isinstance(feedback_spec, CategoricalPointwiseSpec):
            annotation = CategoricalAnnotation(
                test_case_id=test_case_id,
                annotator_id=model_name,
                category="skipped",
                categories=feedback_spec.categories,
                skip=True,
                comment=evaluation.comment,
            )
        elif isinstance(feedback_spec, ContinuousPointwiseSpec):
            annotation = ContinuousAnnotation(
                test_case_id=test_case_id,
                annotator_id=model_name,
                score=0.0,
                score_range=feedback_spec.score_range,
                skip=True,
                comment=evaluation.comment,
            )
        elif isinstance(feedback_spec, RankingSpec):
            annotation = RankingAnnotation(
                test_case_id=test_case_id,
                annotator_id=model_name,
                rankings=list(range(feedback_spec.comparison_items)),
                comparison_items=feedback_spec.comparison_items,
                skip=True,
                comment=evaluation.comment,
            )
        return annotation

    if isinstance(feedback_spec, CategoricalPointwiseSpec):
        annotation = CategoricalAnnotation(
            test_case_id=test_case_id,
            annotator_id=model_name,
            category=evaluation.category.value,
            categories=feedback_spec.categories,
            skip=False,
            comment=evaluation.comment,
        )
    elif isinstance(feedback_spec, ContinuousPointwiseSpec):
        annotation = ContinuousAnnotation(
            test_case_id=test_case_id,
            annotator_id=model_name,
            score=evaluation.score,
            score_range=feedback_spec.score_range,
            skip=False,
            comment=evaluation.comment,
        )
    elif isinstance(feedback_spec, RankingSpec):
        annotation = RankingAnnotation(
            test_case_id=test_case_id,
            annotator_id=model_name,
            rankings=evaluation.rankings,
            comparison_items=feedback_spec.comparison_items,
            skip=False,
            comment=evaluation.comment,
        )

    return annotation


def _calculate_pearson_correlation(
    values_a: list[float], values_b: list[float]
) -> float | None:
    """Calculate Pearson correlation coefficient between two lists of values."""
    if len(values_a) != len(values_b) or len(values_a) == 0:
        return None

    mean_a = statistics.mean(values_a)
    mean_b = statistics.mean(values_b)

    numerator = sum((a - mean_a) * (b - mean_b) for a, b in zip(values_a, values_b))
    denom_a = sum((a - mean_a) ** 2 for a in values_a) ** 0.5
    denom_b = sum((b - mean_b) ** 2 for b in values_b) ** 0.5

    if denom_a == 0 or denom_b == 0:
        return None

    return numerator / (denom_a * denom_b)


def _calculate_mae(values_a: list[float], values_b: list[float]) -> float:
    """Calculate Mean Absolute Error between two lists of values."""
    return sum(abs(a - b) for a, b in zip(values_a, values_b)) / len(values_a)


def _compute_ranking_stats(
    dual_annotated: list[TestCase],
    stats: FeedbackConfigStats,
) -> tuple[int, int, list[tuple[datetime, str]]]:
    """Compute statistics for ranking annotations."""
    agreements = 0
    disagreements = 0
    disagreed_ids = []

    ai_rankings = []
    human_rankings = []

    for tc in dual_annotated:
        ai_rank = tc.ai_annotation.rankings
        human_rank = tc.human_annotation.rankings

        if ai_rank and human_rank and len(ai_rank) == len(human_rank):
            ai_rankings.append(ai_rank)
            human_rankings.append(human_rank)

            if ai_rank == human_rank:
                agreements += 1
            else:
                disagreements += 1
                disagreed_ids.append((tc.human_annotation.timestamp, tc.test_case_id))

    if ai_rankings and human_rankings:
        correlations = []
        for ai_rank, human_rank in zip(ai_rankings, human_rankings):
            corr = _calculate_pearson_correlation(ai_rank, human_rank)
            if corr is not None:
                correlations.append(corr)

        if correlations:
            stats.correlation = sum(correlations) / len(correlations)

    return agreements, disagreements, disagreed_ids


def _compute_categorical_stats(
    dual_annotated: list[TestCase],
    stats: FeedbackConfigStats,
) -> tuple[int, int, list[tuple[datetime, str]]]:
    """Compute statistics for categorical annotations."""
    agreements = 0
    disagreements = 0
    disagreed_ids = []

    ai_categories = []
    human_categories = []
    confusion = defaultdict(lambda: defaultdict(int))

    for tc in dual_annotated:
        ai_cat = tc.ai_annotation.category
        human_cat = tc.human_annotation.category

        ai_categories.append(ai_cat)
        human_categories.append(human_cat)

        if ai_cat == human_cat:
            agreements += 1
        else:
            disagreements += 1
            disagreed_ids.append((tc.human_annotation.timestamp, tc.test_case_id))

        confusion[ai_cat][human_cat] += 1

    stats.ai_category_distribution = dict(Counter(ai_categories))
    stats.human_category_distribution = dict(Counter(human_categories))
    stats.confusion_matrix = {k: dict(v) for k, v in confusion.items()}

    return agreements, disagreements, disagreed_ids


def _compute_continuous_stats(
    dual_annotated: list[TestCase],
    stats: FeedbackConfigStats,
) -> tuple[int, int, list[tuple[datetime, str]]]:
    """Compute statistics for continuous annotations."""
    agreements = 0
    disagreements = 0
    disagreed_ids = []

    ai_scores = []
    human_scores = []

    for tc in dual_annotated:
        ai_score = tc.ai_annotation.score
        human_score = tc.human_annotation.score

        if ai_score is not None and human_score is not None:
            ai_scores.append(ai_score)
            human_scores.append(human_score)

            # For continuous, we consider agreement if within 10% of range
            score_range = tc.ai_annotation.score_range
            tolerance = (score_range[1] - score_range[0]) * 0.1

            if abs(ai_score - human_score) <= tolerance:
                agreements += 1
            else:
                disagreements += 1
                disagreed_ids.append((tc.human_annotation.timestamp, tc.test_case_id))

    if ai_scores and human_scores:
        stats.mean_absolute_error = _calculate_mae(ai_scores, human_scores)

        if len(ai_scores) > 1:
            stats.correlation = _calculate_pearson_correlation(ai_scores, human_scores)

    return agreements, disagreements, disagreed_ids


def compute_feedback_config_stats(
    test_cases: list[TestCase], feedback_spec: AnnotationSpec
) -> FeedbackConfigStats:
    stats = FeedbackConfigStats()
    status_counts = Counter(tc.status for tc in test_cases)
    stats.total_test_cases = len(test_cases)
    stats.pending = status_counts.get(TestCaseStatus.PENDING, 0)
    stats.summarized = status_counts.get(TestCaseStatus.SUMMARIZED, 0)
    stats.ai_annotated = status_counts.get(TestCaseStatus.AI_ANNOTATED, 0)
    stats.human_annotated = status_counts.get(TestCaseStatus.HUMAN_ANNOTATED, 0)
    stats.invalid = status_counts.get(TestCaseStatus.INVALID, 0)

    total_statused = sum(
        [
            stats.pending,
            stats.summarized,
            stats.ai_annotated,
            stats.human_annotated,
            stats.invalid,
        ]
    )
    if total_statused != stats.total_test_cases:
        raise ValueError(
            f"Status count mismatch: {total_statused} statused test cases "
            f"but {stats.total_test_cases} total test cases"
        )

    dual_annotated = [
        tc
        for tc in test_cases
        if (
            tc.ai_annotation is not None
            and tc.human_annotation is not None
            and not tc.ai_annotation.skip
            and not tc.human_annotation.skip
        )
    ]

    if not dual_annotated:
        return stats

    # Compute type-specific statistics
    if feedback_spec.type == "ranking":
        agreements, disagreements, disagreed_ids = _compute_ranking_stats(
            dual_annotated, stats
        )
    elif feedback_spec.type == "categorical":
        agreements, disagreements, disagreed_ids = _compute_categorical_stats(
            dual_annotated, stats
        )
    elif feedback_spec.type == "continuous":
        agreements, disagreements, disagreed_ids = _compute_continuous_stats(
            dual_annotated, stats
        )
    else:
        agreements, disagreements, disagreed_ids = 0, 0, []

    total_compared = agreements + disagreements
    if total_compared > 0:
        stats.agreement_rate = agreements / total_compared
        stats.disagreement_rate = disagreements / total_compared

    disagreed_ids.sort()
    stats.disagreed_test_case_ids = [test_case_id for _, test_case_id in disagreed_ids]

    stats.last_updated = datetime.now(timezone.utc)

    return stats
