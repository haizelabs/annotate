# Ingestion Patterns: Raw Traces → InteractionStep Format

Reference guide for transforming diverse trace formats into the standard `InteractionStep` and `Interaction` structure.

See `scripts/_models.py` for complete data model definitions.

## Overview

**Goal:** Transform raw trace data into `InteractionStep` objects grouped into `Interaction` objects for systematic evaluation.

**Core Concepts:**
- **InteractionStep**: Single span/event in a trace (e.g., one LLM call, one function execution)
- **Interaction**: Collection of related steps grouped by `interaction_id` (e.g., single turn of an agent getting a request and responding). In some cases when theres no interaction grouping that makes sense, each interaction will just contain one step.
- **InteractionGroup**: Optional higher-level grouping via `group_id` (e.g., all interactions from one user, all interactions from one conversation session)

Pay special attention to the `tags` field on individual steps and interactions. The source data may contain this tags attribute as well.
It's good to port over the contents of the source data tags as a starting point, and then think about what kind of data we would find
useful in tags.

In particular, we are interested in fields that help filter for relevant evaluation data. For example if you see a common pattern in a span that indicates it's an LLM call use for summarization, feel free to add a "is_summarizer = true" tag. When it later comes to evaluation and the user wants to only eval summarizer llm calls, this will come in handy. Similarly, if you see a bunch of noisy steps
(e.g. spans representing pydantic validation steps) feel free to add "noisy:true" tag. 

Its a good idea to look at scripts/_models.py:
```
    from scripts.models import InteractionStep, Interaction, TestCase, Annotation, FeedbackConfig

    python -c "from scripts.models import *; print(InteractionStep.model_json_schema())"
    python -c "from scripts.models import *; print(InteractionStep.__doc__)"
```

Later, we'll use the [`AttributeMatcher`](scripts/_annotation_utils)  class to exclude/include certain steps from annotations. Tags are always a handy attribute to use here.

Some ideas of common span tags;
status: ok, error
span_kind: tool, llm, agent


Another principle - DO NOT uncessarily skip data thats a different format, e.g. a trace json thats different from the normal span json. Find a way to incorporate as much as data as possible; e.g. by holding onto trace jsons and populating some info in the Interaction metadata even if it doesn't directly map to an interaction step.

---

## Possible raw data formats and **potential** ingestion approaches

this is a non-exhaustive list of common raw data formats. again, even if the data format is the same (e.g. otel) the shape
of the ai application can wildly vary - so make sure your approach is contextual to the specific data you are seeing.

**GENERAL PRINCIPLE** --> be super defensive only as a last resort to unblock yourself after 2 tries. otherwise, it is ok
to make opiniated assumptions about the data shape from your analysis. The most import thing, as always, is to ask the user for feedback
to make sure you have an very very good understand of the type of data you are about to evaluate.

### Pattern A: OTel-Compatible Traces (Simple)

**When to use:** Your traces follow OpenTelemetry conventions with standard field names.

**Characteristics:**
- Has `span_id`, `trace_id`, `parent_span_id`
- Structured attributes
- Standard timing fields

**Example Transformation:**

```python
def ingest_otel_span(span: dict) -> InteractionStep:
    """Convert OTel span to InteractionStep."""
    attributes = span.get('attributes', {})

    return InteractionStep(
        id=span['span_id'],
        group_id=span.get('session_id'), # or span.get('conversation_id') if it exists
        parent_step_id=span.get('parent_span_id'),
        interaction_id=span['trace_id'],
        name=span.get('name', 'unknown'),
        start_ns=span.get('start_time_unix_nano'),
        duration_ns=span.get('duration'),
        input_data=attributes.get('input'),
        output_data=attributes.get('output'),
        metadata={
            'status': span.get('status', {}).get('code'),
            'kind': span.get('kind')
        },
        raw=attributes,
        # LLM-specific fields (if present)
        model=attributes.get('gen_ai.response.model'),
        input_messages=[
            Message(role=msg.get('role'), content=msg.get('content'))
            for msg in attributes.get('gen_ai.prompt', [])
        ] if attributes.get('gen_ai.prompt') else None,
        output_messages=[
            Message(role=msg.get('role'), content=msg.get('content'))
            for msg in attributes.get('gen_ai.completion', [])
        ] if attributes.get('gen_ai.completion') else None,
        usage=TokenUsage(
            input_tokens=attributes.get('gen_ai.usage.input_tokens'),
            output_tokens=attributes.get('gen_ai.usage.output_tokens')
        ) if attributes.get('gen_ai.usage.input_tokens') else None,
        provider=attributes.get('gen_ai.system')
    )
```

---

### Pattern B: Non-OTel Structured Traces (Complex)

**When to use:** Your traces have custom structure with separate trace/span data, or non-standard field names.

**Example: OpenAI Agents SDK Format**

**Characteristics:**
- Wrapped in `{"object": "trace.span", ...}` format OR ``{"object": "trace", ...}` format - MIXED data types!
- Nested `span_data` object contains LLM info
- Has `trace_id`, `parent_id`
- Root spans have `parent_id: null`; "traces" are their own seperate concept

**Input Structure:**
```json
{
  "object": "trace.span",
  "id": "span_xxx",
  "trace_id": "trace_yyy",
  "parent_id": "span_zzz",
  "started_at": "2025-10-21T18:18:39+00:00",
  "ended_at": "2025-10-21T18:18:49+00:00",
  "span_data": {
    "type": "generation",
    "input": [...messages...],
    "output": [...messages...],
    "model": "gpt-5-mini",
    "usage": {"input_tokens": 379, "output_tokens": 649}
  }
}
```

**Transformation:**

```python
from datetime import datetime

def ingest_oai_agents_span(record: dict) -> InteractionStep:
    """Convert OAI Agents SDK span to InteractionStep."""
    span_data = record.get('span_data', {})

    # Parse timestamps (ISO 8601 with timezone)
    started_at = record.get('started_at')
    ended_at = record.get('ended_at')

    start_ns = None
    duration_ns = None
    if started_at and ended_at:
        start_dt = datetime.fromisoformat(started_at)
        end_dt = datetime.fromisoformat(ended_at)
        start_ns = int(start_dt.timestamp() * 1e9)
        duration_ns = int((end_dt - start_dt).total_seconds() * 1e9)

    input_messages = None
    output_messages = None

    if span_data.get('input'):
        input_messages = [
            Message(role=msg.get('role', 'user'), content=msg.get('content', ''))
            for msg in span_data['input']
        ]

    if span_data.get('output'):
        output_messages = [
            Message(role=msg.get('role', 'assistant'), content=msg.get('content', ''))
            for msg in span_data['output']
        ]

    usage_data = span_data.get('usage', {})
    usage = TokenUsage(
        input_tokens=usage_data.get('input_tokens'),
        output_tokens=usage_data.get('output_tokens'),
        total_tokens=(usage_data.get('input_tokens', 0) + usage_data.get('output_tokens', 0))
            if usage_data.get('input_tokens') and usage_data.get('output_tokens') else None
    ) if usage_data else None

    span_type = span_data.get('type', 'unknown')
    model_name = span_data.get('model', '')
    step_name = f"{span_type}_{model_name}" if model_name else span_type

    return InteractionStep(
        id=record['id'],
        parent_step_id=record.get('parent_id'),  # Note: OAI uses 'parent_id', not 'parent_span_id'
        interaction_id=record['trace_id'],
        name=step_name,
        start_ns=start_ns,
        duration_ns=duration_ns,
        input_data=span_data.get('input'),
        output_data=span_data.get('output'),
        metadata={
            'span_type': span_data.get('type'),
            'error': record.get('error')
        },
        raw=span_data,
        # LLM fields
        model=span_data.get('model'),
        input_messages=input_messages,
        output_messages=output_messages,
        usage=usage,
        provider='openai'  # Inferred from model format
    )
```

#### Handling Mixed Record Types

The data may contain different record types representing different components. For example, OpenAI Agents SDK traces often contain:
- `{"object": "trace.span", ...}` - Actual spans with execution data
- `{"object": "trace", ...}` - Trace-level metadata (workflow name, group_id)

**Complete ingestion with metadata injection:**

```python
# First pass: collect trace metadata
trace_metadata = {}
for record in raw_records:
    if record.get('object') == 'trace':
        trace_id = record.get('trace_id')
        group_id = record.get('group_id')
        workflow_name = record.get('workflow_name')
        if trace_id:
            trace_metadata[trace_id] = {
                'group_id': group_id,
                'workflow_name': workflow_name
            }

# Second pass: ingest spans and inject metadata
steps = []
for record in raw_records:
    if record.get('object') == 'trace.span':
        step = ingest_oai_agents_span(record)

        # Inject group_id and metadata from trace
        trace_id = record.get('trace_id')
        if trace_id in trace_metadata:
            step.group_id = trace_metadata[trace_id]['group_id']
            # Optionally add workflow_name to metadata
            if not step.metadata:
                step.metadata = {}
            step.metadata['workflow_name'] = trace_metadata[trace_id]['workflow_name']

        steps.append(step)
```

**Key Points:**
- Field names vary! (`parent_id` vs `parent_span_id`)
- Root span detection: `parent_id is None`
- Parse ISO 8601 timestamps to nanoseconds
- Extract nested `span_data` fields
- Infer provider from model name if not explicit

---

### Pattern C: Flat Data (CSV/Simple JSON)

**When to use:** Simple tabular data where each row represents one complete interaction.

**Characteristics:**
- No hierarchical relationships
- Direct field mappings
- Each row is self-contained

**Input Example:**
```csv
timestamp,user_id,user_query,final_output,model_used
2025-10-21 10:30:00,user123,"What is AI?","AI stands for...",gpt-4
```

**Transformation:**

```python
from datetime import datetime

def ingest_csv_row(row: dict, index: int) -> InteractionStep:
    """Convert CSV row to InteractionStep."""

    start_ns = None
    if row.get('timestamp'):
        try:
            dt = datetime.fromisoformat(row['timestamp'])
            start_ns = int(dt.timestamp() * 1e9)
        except:
            pass

    step_id = f"row_{index}"

    return InteractionStep(
        id=step_id,
        interaction_id=step_id,  # Each row is its own interaction
        group_id=row.get('user_id'),  # Group by user if available
        name="user_interaction",
        start_ns=start_ns,
        input_data=row.get('user_query'),
        output_data=row.get('final_output'),
        metadata={
            'source_row': index,
            'all_fields': list(row.keys())
        },
        raw=row,
        # LLM info if present
        model=row.get('model_used')
    )
```

---

## Common Ingestion Patterns

### Handling Missing Fields

```python
# Use .get() with sensible defaults
field = record.get('field_name', 'default_value')

# For required fields, raise error or generate synthetic value
if 'id' not in record:
    raise ValueError(f"Record missing required 'id' field: {record}")
```

### Nested Data Access

```python
# Safe nested access
value = record.get('attributes', {}).get('gen_ai', {}).get('model')

# Or helper function
def get_nested(data: dict, path: str, default=None):
    """Get nested value using dot notation: 'attributes.gen_ai.model'"""
    keys = path.split('.')
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
            if data is None:
                return default
        else:
            return default
    return data

value = get_nested(record, 'attributes.gen_ai.model', default=None)
```

### Type Conversions

```python
# Timestamps: seconds → nanoseconds
start_ns = int(record['start_time'] * 1e9)

# Timestamps: ISO 8601 string → nanoseconds
from datetime import datetime
dt = datetime.fromisoformat(record['timestamp'])
start_ns = int(dt.timestamp() * 1e9)

# Duration calculation
duration_ns = int((end_time - start_time) * 1e9)
```


### Handling Mixed Record Types / Two-Pass Ingestion

When your data contains multiple record types (e.g., both span records and trace metadata records), use a two-pass approach:

```python
# First pass: collect metadata from non-span records
trace_metadata = {}
for record in raw_records:
    if record.get('object') == 'trace':
        trace_id = record.get('trace_id')
        group_id = record.get('group_id')
        workflow_name = record.get('workflow_name')
        if trace_id:
            trace_metadata[trace_id] = {
                'group_id': group_id,
                'workflow_name': workflow_name
            }

# Second pass: ingest spans and inject metadata
steps = []
for record in raw_records:
    if record.get('object') == 'trace.span':
        step = ingest_oai_agents_span(record)
        
        # Inject metadata from trace-level records
        trace_id = record.get('trace_id')
        if trace_id in trace_metadata:
            step.group_id = trace_metadata[trace_id]['group_id']
            if not step.metadata:
                step.metadata = {}
            step.metadata['workflow_name'] = trace_metadata[trace_id]['workflow_name']
        
        steps.append(step)
```

### Root Span Detection

```python
def is_root_span(span: dict) -> bool:
    """Check if this is a root span (no parent)."""
    # Check various field names
    return (
        span.get('parent_id') is None or
        span.get('parent_span_id') is None or
        span.get('parent') is None
    )

# Use for creating Interaction wrappers
if is_root_span(span):
    # This could be the interaction-level name
    interaction_name = span.get('name') or span.get('description')
```

### Message Parsing

```python
import json

# Convert various message formats to standard Message objects
def parse_messages(messages_data):
    if not messages_data:
        return None

    result = []
    for msg in messages_data:
        # Handle different formats
        if isinstance(msg, dict):
            role = msg.get('role', 'user')
            
            # Handle content: could be string, dict, or complex object
            content_raw = msg.get('content')
            if isinstance(content_raw, str):
                content = content_raw
            elif content_raw is not None:
                # Complex content (tool calls, functions, etc.) - serialize to JSON
                content = json.dumps(content_raw)
            else:
                content = ''

            # NOTE! or sometimes `content` is missing and you need to find/collect the data
            # from other fields
            
            result.append(Message(role=role, content=content))
        elif isinstance(msg, str):
            result.append(Message(role='user', content=msg))

    return result if result else None
```

### Grouping Steps into Interactions

```python
from collections import defaultdict

def group_steps_into_interactions(steps: list[InteractionStep]) -> dict[str, Interaction]:
    """Group InteractionSteps by interaction_id into Interaction objects."""

    # Group by interaction_id
    by_interaction = defaultdict(list)
    for step in steps:
        if step.interaction_id:
            by_interaction[step.interaction_id].append(step)

    # Create Interaction objects
    interactions = {}
    for interaction_id, interaction_steps in by_interaction.items():
        # Calculate interaction start_ns and duration_ns
        step_start_times = [s.start_ns for s in interaction_steps if s.start_ns is not None]
        step_end_times = []
        for s in interaction_steps:
            if s.start_ns is not None and s.duration_ns is not None:
                step_end_times.append(s.start_ns + s.duration_ns)

        start_ns = min(step_start_times) if step_start_times else None
        end_ns = max(step_end_times) if step_end_times else None
        duration_ns = (end_ns - start_ns) if (start_ns and end_ns) else None

        interactions[interaction_id] = Interaction(
            id=interaction_id,
            steps=interaction_steps,
            start_ns=start_ns,
            duration_ns=duration_ns,
            name=f"Interaction {interaction_id[:8]}"
        )

    return interactions
```

---

## Troubleshooting Guide


### Issue: IDs not unique

**Problem:** Multiple records have same ID

FIRST - this is weird, ask the user whats going on

**Solution:**
```python
# Add sequence number to ensure uniqueness
step_id = f"{record['id']}_{index}"

# Or generate from content hash
import hashlib
step_id = hashlib.md5(str(record).encode()).hexdigest()[:16]
```

### Issue: Parent relationships broken

**Problem:** `parent_step_id` references don't exist

**Solution:**
```python
# Collect all IDs first
all_ids = {record['id'] for record in raw_traces}

# Validate parent references
for record in raw_traces:
    parent_id = record.get('parent_id')
    if parent_id and parent_id not in all_ids:
        # Either set to None or log warning
        record['parent_id'] = None
        print(f"Warning: Orphaned span {record['id']}, parent {parent_id} not found")
```

### Issue: Timestamps in wrong format

**Problem:** Timestamps not converting to nanoseconds

**Solution:**
```python
from datetime import datetime

def parse_timestamp(ts) -> int:
    """Parse various timestamp formats to nanoseconds."""
    if isinstance(ts, int):
        # Assume already in nanoseconds or seconds
        if ts > 1e15:  # Likely already nanoseconds
            return ts
        else:  # Likely seconds
            return int(ts * 1e9)
    elif isinstance(ts, str):
        # Parse ISO 8601
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return int(dt.timestamp() * 1e9)
    return None
```