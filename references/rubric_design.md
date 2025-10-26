# AI Rubric Design: Best Practices

This document explains how to design effective AI rubrics that align with human judgment.

## Overview

The `ai_rubric` field in FeedbackConfig is an f-string template that gets filled with extracted input_items and sent to an LLM for evaluation.

## Judge Design Components

The AI judge we are iterating on has the following components.

### Judge Outputs
- **Labels**: Numeric or categorical values (often ordered by "goodness": good, neutral, bad)
- **Comment**: An open ended, free text comment for the judge; could be rationale for the label, could be something else
- **Option to skip**: ai/human annotators can always skip a test case for whatever reason

### Judge Inputs
- **Static instructions**: Define the judge's purpose, high-level principles, and meanings of each output label
- **Variable components**: System outputs and contextual evaluation variables that change per test case

### Core Requirements

The judge must:
1. Provide reasoning that cites the label description
2. Explain why the chosen label is correct
3. Explain why other labels (or label groups) were NOT chosen
4. Maintain human-readable, explanatory style (not overly mechanical)

## Core Principles

### 1. Be Explicit About Criteria

❌ **Vague:**
```
Evaluate if the response is good.
```

✅ **Explicit:**
```
Evaluate if the agent's response:
1. Directly answers the user's question
2. Uses information from the retrieved context
3. Does not hallucinate facts not present in the context
4. Is concise (< 3 sentences unless question requires detail)
```

### 2. Define Edge Cases

❌ **Ambiguous:**
```
Mark as 'correct' if the answer is right.
```

✅ **Clear Edge Cases:**
```
Mark as 'correct' if:
- The answer directly addresses the question AND uses accurate information

Mark as 'partially_correct' if:
- The answer is directionally correct but missing key details OR
- The answer is correct but uses information not in the provided context

Mark as 'incorrect' if:
- The answer contradicts the correct information OR
- The answer doesn't address the question at all
```

### 3. Use Input Variables Correctly

#### 3a - pointwise rubrics

Your rubric MUST reference ALL input_items defined in `FeedbackConfig`.

**Use XML tags to distinguish variables from instructions:**

```python
# FeedbackConfig
{
  "input_items": [
    {"name": "user_query", ...},
    {"name": "system_output", ...},
    {"name": "retrieved_context", ...}
  ],
  "ai_rubric": """
Evaluate the agent's response to the user's query.

<user_query>{user_query}</user_query>
<retrieved_context>{retrieved_context}</retrieved_context>
<system_output>{system_output}</system_output>

[Evaluation criteria here]
"""
}
```

**Format requirements:**
- Wrap each variable in XML tags: `<variable_name>{variable_name}</variable_name>`
- Use single curly braces (Python f-string style): `{variable_name}`
- Every `{variable}` must match an input_item name exactly
- XML tags clearly separate variable content from instructions

#### 3b - ranking requirements
Your rubric must reference ALL the input items as well as HOW to compare them.

Given N comparison items, the rubric must include variables:

<input.name>_0 <input.name>_1 ... <input.name>_(N-1)
for each input item name

And specify how to compare them.

**Example ranking rubric:**

```python
# FeedbackConfig with 2 comparison items
{
  "input_items": [
    {"name": "ai_input", ...},
    {"name": "ai_output", ...}
  ],
  "ai_rubric": """
Rank the following AI interactions from best to worst (0 = best, 1 = worst).

Consider both the input query and the AI's response quality.

<Interaction 0>
Input: {ai_input_0}
Output: {ai_output_0}
</Interaction 0>

<Interaction 1>
Input: {ai_input_1}
Output: {ai_output_1}
</Interaction 1>

Evaluate which interaction produced a better response given the input query.
"""
}
```

**Format requirements:**
- Prefix each variable with its index: `{variable_name_0}`, `{variable_name_1}`
- Use XML tags to distinguish each comparison item
- Make sure the rubric mentions the ordering requirements! Best is first in the output list, worst is last.

## Reasoning Requirements

When designing your rubric, explicitly instruct the judge to include:

### 1. Quote Specific Evidence
**Rationales must quote relevant parts of the inputs:**

```
In your reasoning, quote specific parts of:
- The system output (use quotation marks)
- Relevant input variables (use quotation marks)
```

### 2. Cite Label Descriptions
**Reasoning must reference why the chosen label fits:**

```
Your reasoning must:
1. Cite the label description that applies
2. Explain why this label is appropriate
3. Explain why other labels do NOT apply
```

### 3. Avoid Empty Descriptors
**Ground evaluations in concrete evidence:**

```
Unless it is blatantly obvious, avoid using empty terms like "good", "bad", "expert",
or any similar descriptive language without grounding them in concrete examples or
facts provided in the context.
```

## Handling Skips/Not Applicable

Include guidance for when evaluation doesn't apply:

```python
{
  "ai_rubric": """
Evaluate if the agent used the correct tool for the user's request.

User Request: {user_request}
Tools Available: {available_tools}
Tool Used: {tool_used}

If the request doesn't require tool usage, respond with: SKIP

Otherwise, mark as:
- 'correct': Used the most appropriate tool
- 'suboptimal': Used a tool that works but isn't ideal
- 'incorrect': Used wrong tool or should have used a tool but didn't

Category:"""
}
```