import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator
import ast


def _extract_fstring_variables(fstring: str) -> list[str]:
    """Extract variable names from an f-string template."""

    class FStringVisitor(ast.NodeVisitor):
        def __init__(self) -> None:
            self.variables: list[str] = []

        def visit_FormattedValue(self, node: ast.FormattedValue) -> None:
            if isinstance(node.value, ast.Name):
                self.variables.append(node.value.id)
            self.generic_visit(node)

    try:
        tree = ast.parse(f"f'''{fstring}'''", mode="eval")
    except SyntaxError:
        raise ValueError("Invalid f-string")

    visitor = FStringVisitor()
    visitor.visit(tree.body)
    return visitor.variables


class Message(BaseModel):
    """Minimal representation of an LLM message."""

    role: str
    content: Any


class TokenUsage(BaseModel):
    """Token usage statistics for an LLM invocation."""

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class InteractionStep(BaseModel):
    """
    Single step/unit in an interaction (e.g., API call, LLM invocation, tool call, database query).

    Represents a single atomic operation in an AI application trace. Can contain general operation data
    or specialized LLM-specific fields when the step represents an LLM call.
    """

    id: str
    parent_step_id: Optional[str] = Field(
        default=None,
        description="ID of the parent step that this step belongs to, e.g. a parent span in a trace",
    )
    interaction_id: Optional[str] = Field(
        default=None,
        description="ID of the interaction that this step belongs to, e.g. a single turn in a multi-turn conversation",
    )
    group_id: Optional[str] = Field(
        default=None,
        description="ID of the group that this step belongs to, e.g. a session or user",
    )
    name: Optional[str] = Field(
        default=None,
        description="Name of the step, e.g. 'LLM call', 'tool call', 'database query', etc.",
    )
    start_ns: Optional[int] = None  # nanoseconds since epoch
    duration_ns: Optional[int] = None  # duration in nanoseconds
    input_data: Optional[Any] = None
    output_data: Optional[Any] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)  # Original record data

    tags: Optional[dict[str, str]] = Field(
        default=None, description="arbitrary ways of categorizing this particular step"
    )

    # Optional LLM-specific fields (populated when this step represents an LLM invocation)
    model: Optional[str] = None
    input_messages: Optional[list[Message]] = None
    output_messages: Optional[list[Message]] = None
    usage: Optional[TokenUsage] = None
    provider: Optional[str] = None


class Interaction(BaseModel):
    """A complete interaction composed of multiple steps (e.g., a trace, request/response pair)."""

    id: str
    steps: list[InteractionStep]
    start_ns: Optional[int] = None
    group_id: Optional[str] = Field(
        default=None,
        description="ID of the group that this interaction belongs to, e.g. a session or user",
    )
    duration_ns: Optional[int] = None
    name: Optional[str] = Field(
        default=None,
        description="Optional name/label for this interaction (e.g., from root span or trace metadata)",
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description of what this interaction represents",
    )
    tags: dict[str, Any] = Field(
        default_factory=dict,
        description="Flexible key-value storage for additional metadata",
    )

    def save(self, path: str) -> None:
        """
        Save interaction to filesystem directory structure:
        {path}/
          ├── metadata.json  (all fields except steps)
          └── steps.jsonl    (one InteractionStep per line)
        """
        from pathlib import Path
        import json

        interaction_dir = Path(path)
        interaction_dir.mkdir(parents=True, exist_ok=True)

        # Save metadata (everything except steps)
        metadata = self.model_dump(exclude={"steps"}, mode="json")
        with open(interaction_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        # Save steps as JSONL
        with open(interaction_dir / "steps.jsonl", "w") as f:
            for step in self.steps:
                f.write(json.dumps(step.model_dump(mode="json")) + "\n")

    @classmethod
    def load(cls, path: str) -> "Interaction":
        """
        Load interaction from filesystem directory structure.
        Reads metadata.json and steps.jsonl.
        """
        from pathlib import Path
        import json

        interaction_dir = Path(path)

        with open(interaction_dir / "metadata.json", "r") as f:
            metadata = json.load(f)

        # Load steps
        steps = []
        with open(interaction_dir / "steps.jsonl", "r") as f:
            for line in f:
                if line.strip():
                    steps.append(InteractionStep(**json.loads(line)))

        return cls(**metadata, steps=steps)


class InteractionGroup(BaseModel):
    """A group of related interactions (e.g., a session, user, experiment)."""

    id: str = Field(
        description="ID of the group that this interaction group belongs to"
    )
    interactions: list[Interaction]


RawJudgeInput = Union[InteractionStep, Interaction, InteractionGroup]


def _get_attr(obj: Any, attr: str) -> Any:
    try:
        if isinstance(obj, dict):
            return obj.get(attr)
        return getattr(obj, attr)
    except (KeyError, AttributeError):
        raise AttributeError(f"Attribute {attr} not found")


class AttributeMatcher(BaseModel):
    """Fast attribute-based filtering criteria using path matching on InteractionStep/Interaction/InteractionGroup objects."""

    attribute_path: str = Field(
        description="Dot-separated path to the attribute; must be compatible with the InteractionStep/Interaction/InteractionGroup objects"
    )
    contains_str: Optional[str] = Field(
        default=None,
        description="String that the attribute value must contain to match",
    )
    matches_regex: Optional[str] = Field(
        default=None,
        description="Regex pattern that the attribute value must match",
    )
    equals_value: Optional[Any] = Field(
        default=None,
        description="Exact value that the attribute must equal to match",
    )

    def matches(self, obj: InteractionStep | Interaction | InteractionGroup) -> bool:
        """Check if the object matches this criteria."""
        try:
            value = self._get_nested_value(obj, self.attribute_path)

            if self.contains_str is not None:
                return self.contains_str in str(value)
            elif self.matches_regex is not None:
                return bool(re.search(self.matches_regex, str(value)))
            elif self.equals_value is not None:
                return value == self.equals_value
            else:
                return False

        except (KeyError, IndexError, TypeError, AttributeError):
            return False

    def _get_nested_value(
        self, obj: InteractionStep | Interaction | InteractionGroup, path: str
    ) -> Any:
        """Get nested value using dot notation and array indexing for structured data types."""
        current = obj
        parts = path.split(".")

        for part in parts:
            if "[" in part and "]" in part:
                key = part[: part.index("[")]
                index_str = part[part.index("[") + 1 : part.index("]")]
                index = int(index_str)
                attr_value = _get_attr(current, key)
                if isinstance(attr_value, list) and len(attr_value) > index:
                    current = attr_value[index]
                else:
                    raise IndexError(f"Array index {index} out of range for {key}")
            else:
                current = _get_attr(current, part)

        return current


class RankingSpec(BaseModel):
    """Ranking-based annotation (preference learning)."""

    type: Literal["ranking"] = "ranking"
    comparison_items: int = Field(
        default=2, description="The number of items to compare"
    )


class CategoricalPointwiseSpec(BaseModel):
    """Categorical annotation (labeling)."""

    type: Literal["categorical"] = "categorical"
    categories: Optional[list[str]] = Field(
        default=["pass", "fail"],
        description="The categories to assign the AI interaction to",
    )


class ContinuousPointwiseSpec(BaseModel):
    """Continuous scoring annotation."""

    type: Literal["continuous"] = "continuous"
    score_range: tuple[float, float] = Field(
        default=(0, 10),
        description="The range of scores to assign the AI interaction to",
    )


AnnotationSpec = Union[RankingSpec, CategoricalPointwiseSpec, ContinuousPointwiseSpec]


class InputItem(BaseModel):
    """Defines a specific input variable for judge evaluation."""

    name: str = Field(
        description="Variable name (e.g., 'retrieved_context', 'system_output')"
    )
    description: str = Field(
        description="Detailed description of what this variable represents"
    )


class Reference(BaseModel):
    """Citation reference tracking where a value was extracted from."""

    type: Literal["step", "interaction", "group"] = Field(
        description="The type of the reference"
    )
    id: str = Field(description="The ID of the step/interaction/group")
    field: Optional[str] = Field(
        default=None,
        description="Specific field path within the object (e.g., 'input_data.query')",
    )


class InputItemValue(InputItem):
    """InputItem with the actual extracted/summarized value."""

    value: str = Field(
        description="The extracted or summarized value for this input item as a string"
    )
    references: list[Reference] = Field(
        default_factory=list,
        description="Citation references tracking where this value was sourced from",
    )


class FeedbackConfigStats(BaseModel):
    """Performance statistics for AI judge vs human annotations.

    Tracks comprehensive metrics about AI judge performance including:
    - Status counts (pending, ai_annotated, human_annotated, etc.)
    - Agreement/disagreement rates between AI and human
    - Category distributions and confusion matrix (for categorical)
    - MAE and correlation (for continuous scoring)
    - List of disagreed test cases for review
    """

    total_test_cases: int = 0
    pending: int = 0
    summarized: int = 0
    ai_annotated: int = 0
    human_annotated: int = 0
    invalid: int = 0

    agreement_rate: Optional[float] = Field(
        default=None,
        description="Percentage of test cases where AI and human agree (0.0 to 1.0)",
    )
    disagreement_rate: Optional[float] = Field(
        default=None,
        description="Percentage of test cases where AI and human disagree (0.0 to 1.0)",
    )
    disagreed_test_case_ids: list[str] = Field(
        default_factory=list,
        description="Test case IDs where AI and human annotations disagreed (sorted by timestamp)",
    )

    ai_category_distribution: dict[str, int] = Field(
        default_factory=dict, description="Count of AI annotations per category"
    )
    human_category_distribution: dict[str, int] = Field(
        default_factory=dict, description="Count of human annotations per category"
    )
    confusion_matrix: dict[str, dict[str, int]] = Field(
        default_factory=dict,
        description="Confusion matrix: confusion_matrix[ai_category][human_category] = count",
    )

    mean_absolute_error: Optional[float] = Field(
        default=None, description="Mean absolute error between AI and human scores"
    )
    correlation: Optional[float] = Field(
        default=None,
        description="Pearson correlation coefficient between AI and human scores",
    )
    last_updated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when stats were last computed",
    )


class FeedbackConfig(BaseModel):
    """
    Unified configuration defining WHAT to evaluate and HOW to present it.
    Used by both human annotators and AI judges to ensure consistent evaluation criteria.
    """

    id: str = Field(
        description="ID of the feedback config - should be autogenerated each time the config changes"
    )
    granularity: Literal["step", "interaction", "group"] = Field(
        default="step",
        description="""The granularity of raw data passed in for evaluation:
            'step' for individual operations,
                example: evaluating an LLM step for incorrect tool calls
            'interaction' for complete traces,
                example: evaluating the quality of an agent's response to a user query
            'group' for session-level evaluation,
                example: evaluating the the agent helped accomplish the user's goal in a chat session""",
    )
    requires_context: Optional[Literal["interaction", "group"]] = Field(
        default=None,
        description="""The context required for the evaluation:
            'interaction' for complete traces,
                example: in order to evaluate the correctness of a tool call, we must include some context on what happened before and after the tool call.
            'group' for session-level evaluation,
                example: in order to evaluate the quality of the agent's response, we must include some context on the previous messages (interactions) in the conversation.""",
    )
    feedback_spec: AnnotationSpec = Field(
        default_factory=RankingSpec,
        description="The type of feedback to collect: ranking (comparison), categorical (labeling), or continuous (scoring)",
    )
    input_items: list[InputItem] = Field(
        default_factory=list,
        description="List of data fields to extract from interactions and present to the evaluator (human or AI)",
    )
    ai_rubric: str = Field(
        description="""The evaluation rubric/prompt for the AI judge. Input items are fed into the ai rubric through prompt variables expressed as f-strings
        The rubric must contain prompt variables EXACTLY matching ALL names of the input items, and NO MORE. Also in the rubric feel free to specify when to
        skip the eval when the input is not relevant; this should match up with `natural_language_disqualifier`.

        For ranking based evaluations, the rubric variable names should be prefixed with the item index, e.g.
        ai_output_0, input_query_0, ai_output_1, input_query_1 and ideally have xml tags to distinguish each unique
        judge input to be compared.

        Example ranking rubric:

        Rank the following AI interactions from best to worst (0 = best, 1 = worst).

        Consider both the input query and the AI's response quality.

        <Interaction 0>
        Input: {0_ai_input}
        Output: {0_ai_output}
        </Interaction 0>

        <Interaction 1>
        Input: {1_ai_input}
        Output: {1_ai_output}
        </Interaction 1>

        Evaluate which interaction produced a better response given the input query.
        """
    )
    attribute_matchers: list[AttributeMatcher] = Field(
        description="""Attribute-based whitelist for data to evaluate. Test cases must match ALL matchers to be included. If any matcher doesn't match, the test case is excluded.
        Think step by step for this one! Throwing random attributes here will result in LOTS of false negatives and data being excluded. At the same time, we don't want to
        include data that is obviously noisy and irrelevant. Attribute matchers `match` function takes ANY OF an interaction step, interaction, or group of interactions
        as input; keep that in mind when desigining matchers. It must be in sync with `granularity` described in the feedback config.
        """
    )
    natural_language_disqualifier: Optional[str] = Field(
        default=None,
        description="Natural language criteria for disqualifying interactions from evaluation. This is checked after the attribute matchers.",
    )
    stats: Optional[FeedbackConfigStats] = Field(
        default=None,
        exclude=True,
        description="Performance statistics for AI judge (excluded from test case serialization)",
    )

    @classmethod
    def compute_id(
        cls,
        granularity: str,
        requires_context: Optional[str],
        feedback_spec_type: str,
        input_items: list[InputItem],
    ) -> str:
        hash_data = {
            "granularity": granularity,
            "requires_context": requires_context,
            "feedback_spec_type": feedback_spec_type,
            "input_items": [
                {"name": item.name, "description": item.description}
                for item in input_items
            ],
        }
        json_str = json.dumps(hash_data, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()[:16]

    @model_validator(mode="before")
    @classmethod
    def populate_missing_id(cls, data: Any) -> Any:
        """Always populate `id` deterministically from other fields."""
        if isinstance(data, dict):
            granularity = data.get("granularity")
            requires_context = data.get("requires_context")
            feedback_spec = data.get("feedback_spec")
            input_items = data.get("input_items", [])
            if granularity is not None and feedback_spec is not None:
                if isinstance(feedback_spec, dict):
                    feedback_spec_type = feedback_spec.get("type")
                else:
                    feedback_spec_type = feedback_spec.__class__.__name__
                processed_input_items = []
                for item in input_items:
                    if isinstance(item, dict):
                        processed_input_items.append(InputItem(**item))
                    else:
                        processed_input_items.append(item)

                data["id"] = cls.compute_id(
                    granularity=granularity,
                    requires_context=requires_context,
                    feedback_spec_type=feedback_spec_type,
                    input_items=processed_input_items,
                )
        return data

    @model_validator(mode="after")
    def validate_ai_rubric(self) -> "FeedbackConfig":

        def validate_pointwise_rubric(rubric: str) -> None:
            actual_variables = _extract_fstring_variables(rubric)
            expected_variables = [item.name for item in self.input_items]
            if sorted(actual_variables) != sorted(expected_variables):
                raise ValueError(
                    f"Rubric has incorrect variables. Expected: {expected_variables}, but found: {actual_variables}."
                )

        def validate_ranking_rubric(rubric: str) -> None:
            actual_variables = _extract_fstring_variables(rubric)
            expected_variables = [
                f"{item_name}_{i}"
                for i in range(self.feedback_spec.comparison_items)
                for item_name in [item.name for item in self.input_items]
            ]
            if sorted(actual_variables) != sorted(expected_variables):
                raise ValueError(
                    f"Rubric has incorrect variables. Expected: {expected_variables}, but found: {actual_variables}."
                )

        (
            validate_pointwise_rubric(self.ai_rubric)
            if (
                isinstance(self.feedback_spec, CategoricalPointwiseSpec)
                or isinstance(self.feedback_spec, ContinuousPointwiseSpec)
            )
            else validate_ranking_rubric(self.ai_rubric)
        )
        return self


class TestCaseStatus(str, Enum):
    """Test case status in the annotation pipeline."""

    PENDING = "pending"
    SUMMARIZED = "summarized"
    AI_ANNOTATED = "ai_annotated"
    HUMAN_ANNOTATED = "human_annotated"
    INVALID = "invalid"


class JudgeInput(BaseModel):
    """
    Extracted input items ready for judge evaluation.
    These are saved as individual files in extracted_judge_inputs/ directory.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_type: Literal["step", "interaction", "group"] = Field(
        description="The granularity of the source data"
    )
    source_ids: list[str] = Field(
        description="IDs of source steps/interactions/groups that this input was extracted from"
    )
    input_items: list[InputItemValue] = Field(
        description="The inputs that were extracted from the interaction"
    )
    raw_input: Union[InteractionStep, Interaction, InteractionGroup] = Field(
        description="The raw input that was summarized to generate the judge inputs"
    )

    def save(self, path: str) -> None:
        """Save JudgeInput as JSON file."""
        import json
        from pathlib import Path

        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w") as f:
            json.dump(self.model_dump(mode="json"), f, indent=2)

    @classmethod
    def load(cls, path: str) -> "JudgeInput":
        """Load JudgeInput from JSON file."""
        import json
        from pathlib import Path

        with open(Path(path), "r") as f:
            data = json.load(f)
        return cls(**data)


class BaseAnnotation(BaseModel):
    """Base annotation model with minimal metadata."""

    annotation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    test_case_id: str = Field(description="ID of the test case being annotated")
    annotator_id: str = Field(
        description="Username or model name (e.g., 'human', 'claude-sonnet-4')"
    )
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    skip: bool = Field(
        default=False, description="Whether the annotation was skipped by the annotator"
    )
    comment: Optional[str] = Field(
        default=None,
        description="A comment from the annotator - e.g. why they skipped or annotated the test case a certain way",
    )


class RankingAnnotation(BaseAnnotation):
    """Ranking annotation with actual ranked IDs."""

    type: Literal["ranking"] = "ranking"
    comparison_items: int = Field(description="Number of items compared")
    rankings: list[int] = Field(
        description="Indices in ranked order from best to worst"
    )


class CategoricalAnnotation(BaseAnnotation):
    """Categorical annotation with selected category."""

    type: Literal["categorical"] = "categorical"
    categories: list[str] = Field(description="Available categories")
    category: str = Field(description="The selected category")


class ContinuousAnnotation(BaseAnnotation):
    """Continuous annotation with assigned score."""

    type: Literal["continuous"] = "continuous"
    score_range: tuple[float, float] = Field(description="Valid score range")
    score: Optional[float] = Field(default=None, description="The assigned score")


Annotation = Union[RankingAnnotation, CategoricalAnnotation, ContinuousAnnotation]


class BaseTestCase(BaseModel):
    """Base test case containing shared fields for all annotation test cases."""

    test_case_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    feedback_config: FeedbackConfig = Field(
        description="Feedback configuration defining what and how to evaluate"
    )
    granularity: str = Field(
        description="Level of granularity (step/interaction/group)"
    )
    ai_annotation: Optional[Annotation] = Field(
        default=None, description="AI-generated annotation"
    )
    human_annotation: Optional[Annotation] = Field(
        default=None, description="Human-provided annotation"
    )
    status: TestCaseStatus = Field(default=TestCaseStatus.PENDING)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_annotation_consistency(self) -> "BaseTestCase":
        """Ensure annotations match the expected type based on feedback_spec and granularity."""
        feedback_spec = self.feedback_config.feedback_spec
        if self.granularity != self.feedback_config.granularity:
            raise ValueError(
                f"Test case granularity '{self.granularity}' must match feedback_config granularity "
                f"'{self.feedback_config.granularity}'"
            )

        def validate_annotation_type(
            annotation: Optional[Annotation], name: str
        ) -> None:
            if annotation is None or annotation.skip:
                return

            if isinstance(feedback_spec, RankingSpec):
                if not isinstance(annotation, RankingAnnotation):
                    raise ValueError(
                        f"{name} annotation must be RankingAnnotation for ranking feedback_spec, "
                        f"got {type(annotation).__name__}"
                    )
            elif isinstance(feedback_spec, CategoricalPointwiseSpec):
                if not isinstance(annotation, CategoricalAnnotation):
                    raise ValueError(
                        f"{name} annotation must be CategoricalAnnotation for categorical feedback_spec, "
                        f"got {type(annotation).__name__}"
                    )
            elif isinstance(feedback_spec, ContinuousPointwiseSpec):
                if not isinstance(annotation, ContinuousAnnotation):
                    raise ValueError(
                        f"{name} annotation must be ContinuousAnnotation for continuous feedback_spec, "
                        f"got {type(annotation).__name__}"
                    )

        validate_annotation_type(self.ai_annotation, "AI")
        validate_annotation_type(self.human_annotation, "Human")

        return self

    def save(self, path: str) -> None:
        """Save TestCase as JSON file."""
        import json
        from pathlib import Path

        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w") as f:
            json.dump(self.model_dump(mode="json"), f, indent=2)

    @classmethod
    def load(cls, path: str) -> "BaseTestCase":
        """Load TestCase from JSON file."""
        import json
        from pathlib import Path

        with open(Path(path), "r") as f:
            data = json.load(f)
        return cls(**data)


class PointwiseAnnotationTestCase(BaseTestCase):
    """Test case for pointwise annotation (categorical or continuous)."""

    test_case_type: Literal["pointwise"] = Field(default="pointwise")
    raw_judge_input: RawJudgeInput = Field(
        description="The raw interaction data before extraction"
    )
    judge_input: Optional[JudgeInput] = Field(
        default=None, description="Extracted judge input after summarization"
    )


class RankingAnnotationTestCase(BaseTestCase):
    """Test case for ranking annotation."""

    test_case_type: Literal["ranking"] = Field(default="ranking")
    comparison_items: int = Field(description="Number of items being compared")
    raw_judge_inputs: list[RawJudgeInput] = Field(
        description="List of raw interaction data to compare"
    )
    judge_inputs: Optional[list[JudgeInput]] = Field(
        default=None, description="List of extracted judge inputs after summarization"
    )


TestCase = Union[PointwiseAnnotationTestCase, RankingAnnotationTestCase]
