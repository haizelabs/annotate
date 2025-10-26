# Feedback Configuration Design Guide

Guide for designing feedback configurations that define **WHAT** to evaluate and **HOW**.

## Overview

Survey the user on what aspect of their LLM application they want to QA/review/evaluate.
These questions **MUST be contextual** to their specific data.

After we know what specifically the user wants to evaluate, we need to think a lot about what sort of data is necessary to present to the user for this evaluation.

Note: it's a good idea to explore the interaction data before generating a feedback config. YOU SHOULD NOT BE exploring the original raw data.

## Evaluation Granularity

Does the user need to see a single step of an interaction, the full interaction, or even a group of interactions?

### Granularity Levels

Here are some boilerplate, basic examples, though it may not necessarily map to the data being annotated:

- **`step`**: Individual operations (e.g., "did this LLM call use the right tool?")
- **`interaction`**: Complete traces (e.g., "did the agent answer the user's question?")
- **`group`**: Session-level (e.g., "did the agent help accomplish the user's goal?")

Sometimes, you want to evaluate at a certain granularity level (e.g llm call tool choice which is typically at the step level) but it requires some additional information an individual step doesn't have (e.g. did the tool that was called produce helpful results). For these cases, you must use the `requires_context` field of the feedback config to encode more context into the individual eval.

In most LLM applications, "step" based evals will be similar to analyzing some sub-component of that AI application, while interaction/group based evals are more like end to end evaluations.

## Filtering Relevant Data

Another important aspect of feedback is knowing what data to filter for could be relevant for the eval
in the first place. For this, we use attribute matchers. You can check out how they work in the data models python file (_models.py).

### Attribute Matchers

Add `attribute_matchers` to filter relevant data (optional).

This will REQUIRE that the data we evaluate matches a certain pattern you enforce; e.g. the step name must contain "generation".

**Think carefully for this one!! And definitely get feedback from the user if you are unsure**
- Throwing random attributes here will result in **LOTS of false negatives** and data being excluded
- At the same time, we don't want to include data that is obviously noisy and irrelevant

Attribute matchers are also a dependent on GRANULARITY - pay attention to this! If the granularity is at the interaction level, do not
write a matcher that assumes field paths of steps.

If the source data is CLEAN - e.g. comes from a dataset explicitly for evals, you probably don't need to use this. If the source
data comes from wild west trace data that has a bunch of other traces/logs that are not super ai related, you probably will need to use this.

### AttributeMatcher Examples for Common Use Cases

Here are practical examples of how to use AttributeMatchers for common AI evaluation scenarios. **NOTE** - you should treat these as toy scenarios; real world data may be much, much more gross and complex.

#### Use Case 1: RAG System - Evaluating Retrieval Relevance to Query

**Scenario:** You want to evaluate if the retrieved documents are relevant to the user's query.

**Granularity:** `interaction`
**Goal:** Capture interactions containing both the query and retrieval steps to evaluate relevance

```json
{
  "attribute_matchers": [
    {
      "attribute_path": "steps",
      "contains_str": "retrieval"
    }
  ]
}
```

**Why this works:** To evaluate if retrieved documents are relevant to a query, you need to see BOTH:
1. The user's original query
2. The documents that were retrieved

This requires `interaction` granularity because the query and retrieval happen in separate steps within the same interaction. The attribute matcher filters for interactions that contain a retrieval step (using `steps` attribute which contains the serialized steps).

**Input Items Configuration:**
You'll need to configure `input_items` to extract both pieces of information:
```json
{
  "input_items": [
    {
      "name": "user_query",
      "description": "The user's original query or question"
    },
    {
      "name": "retrieved_docs",
      "description": "The documents retrieved by the RAG system"
    }
  ]
}
```

---

#### Use Case 2: Agent Tool Usage - Evaluating Tool Selection

**Scenario:** You want to evaluate if your agent chose the right tool for the task.

**Granularity:** `step`
**Goal:** Filter for LLM steps that made tool calls

```json
{
  "attribute_matchers": [
    {
      "attribute_path": "output_messages[0].content",
      "contains_str": "Tool Call"
    },
    {
      "attribute_path": "model",
      "matches_regex": "gpt-|claude-"
    }
  ]
}
```

**Why this works:** First matcher checks if the output contains tool call information. Second ensures it's an LLM call (has a model). Together they filter for only LLM steps that invoked tools, excluding regular text generation.

---

#### Use Case 3: Multi-Turn Conversations - Evaluating Final Response

**Scenario:** You want to evaluate the quality of complete conversations with users.

**Granularity:** `interaction`
**Goal:** Filter for specific types of conversations (e.g., customer support)

```json
{
  "attribute_matchers": [
    {
      "attribute_path": "tags.conversation_type",
      "equals_value": "user_support"
    },
    {
      "attribute_path": "steps",
      "matches_regex": ".*"
    }
  ]
}
```

**Why this works:** First matcher ensures we only look at interactions tagged as "user_support". Second ensures the interaction has at least some steps (non-empty). This filters out irrelevant conversation types while ensuring complete interactions.

**Note:** Make sure your ingestion script populates `tags` appropriately for this to work.

---

#### Use Case 4: Code Generation - Evaluating Correctness

**Scenario:** You want to evaluate if generated code is correct and follows best practices.

**Granularity:** `step`
**Goal:** Filter for code generation steps in a specific programming language

```json
{
  "attribute_matchers": [
    {
      "attribute_path": "name",
      "contains_str": "code_generation"
    },
    {
      "attribute_path": "output_data.language",
      "equals_value": "python"
    }
  ]
}
```

**Why this works:** First matcher targets steps explicitly labeled as code generation. Second filters for only Python code. This is useful when your system generates code in multiple languages but you want to evaluate Python specifically.

**Alternative:** If you want ALL programming languages, remove the second matcher.

---

#### Use Case 5: Agentic Workflows - Evaluating Planning

**Scenario:** You want to evaluate if your agent created a good execution plan.

**Granularity:** `interaction`
**Goal:** Filter for interactions that involve planning/strategy

```json
{
  "attribute_matchers": [
    {
      "attribute_path": "name",
      "matches_regex": ".*plan.*|.*strategy.*"
    },
    {
      "attribute_path": "metadata.tags",
      "contains_str": "agent"
    }
  ]
}
```

**Why this works:** First matcher uses regex to capture interactions with "plan" or "strategy" in their name (case-insensitive). Second ensures it's agent-related by checking metadata tags. This filters for planning phases of agent execution.

---

#### Use Case 6: Clean Dataset - No Filtering Needed

**Scenario:** Your data is already curated for evaluation (e.g., a benchmark dataset).

**Granularity:** Any
**Goal:** Include all data without filtering

```json
{
  "attribute_matchers": []
}
```

**Why this works:** An empty array means NO filtering - all interactions/steps at your chosen granularity will be included. Use this when:
- Data comes from a clean evaluation dataset
- All traces are already relevant to your evaluation task
- You want to manually review everything without pre-filtering

**Caution:** Don't use empty matchers on "wild west" production traces - you'll get overwhelmed with irrelevant data!

---

### Tips for Designing AttributeMatchers

1. **Start permissive, then tighten:** Begin with fewer matchers and add more as you see what data gets through
2. **Validate with sample data:** Check a few interactions to ensure your matchers work as expected
3. **Remember it's AND logic:** ALL matchers must pass for data to be included
4. **Use the right operator:**
   - `contains_str`: For partial matches (flexible)
   - `equals_value`: For exact matches (strict)
   - `matches_regex`: For pattern matching (powerful but complex)
5. **Match your granularity:** If evaluating at `step` level, matchers check step attributes. If `interaction`, they check interaction attributes.

## FeedbackConfig Model

The `feedback_config.json` file contains **raw JSON data** that will be loaded into the `FeedbackConfig` Pydantic object (see `scripts/_models.py`).

Both human annotators and AI judges use the **SAME** `feedback_config`, ensuring consistency.

## Rubric Design

This annotation experience is AI assisted; our goal is almost to create a clone of the annotator preferences and encode this in `ai_rubric`. We want to make sure the AI annotations are as close as possible to the human annotations.

From this, we can design the specific data schema that will actually be shown to AI/human evaluators and an AI rubric with clear criteria (see [rubric_design.md](./rubric_design.md)).

## InputItem Configuration Examples

### Example 1: User Query

```json
{
  "name": "user_query",
  "description": "The original question or request from the user",
}
```

### Example 2: Retrieved Context (RAG)

```json
{
  "name": "retrieved_context",
  "description": "The context documents retrieved by the RAG system to answer the user's query",
}
```

### Example 3: System Output

```json
{
  "name": "system_output",
  "description": "The final response generated by the AI system and surfaced to the end user",
}
```

### Example 4: Complex Data

```json
{
  "name": "tool_calls",
  "description": "The sequence of tool/function calls made by the AI agent during execution",
}
```



**CRITICAL** NEVER directly edit the feedback config or test cases directory. Managing these will be handled by the annotation server
