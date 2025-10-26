pass# Annotate

This repository contains a claude code skill to help with exploring and annotating agent trace data 

## Quick Start

### 1. Navigate to a directory with agent traces

```bash
cd /path/to/your/agent/traces
```

### 2. Invoke the skill in Claude Code

```
use annotate
```

Claude will guide you through:
1. **Ingesting** your raw traces into a normalized format
2. **Configuring** what you want to evaluate (pass/fail? pairwise ranking? scoring?)
3. **Annotating** in a web UI while AI judge runs in parallel

### 3. That's it!

The skill handles:
- Setting up the annotation server (FastAPI + React)
- Generating test cases from your data
- Running AI judge in the background
- Tracking human vs AI agreement rates

## What Gets Created

When you use this skill, it creates a `.haize_annotations/` directory in your working directory:

```
your-project/
├── .haize_annotations/
│   ├── ingest.py              # Your custom ingestion script
│   ├── ingested_data/         # Normalized traces
│   ├── feedback_config.json   # Evaluation criteria
│   └── test_cases/            # Annotated cases
└── your-raw-traces/
```

All state lives here - delete it to start fresh.

## Installation (One-Time)

The skill needs Python and Node.js dependencies:

```bash
# Install Python backend dependencies
cd /path/to/ann-cli/ann_cli/annotate
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
yarn install
```

## Common Use Cases

**Evaluate conversation quality**
- Did the agent answer the user's question?
- Pass/fail at the session level

**Compare agent responses**
- Which response is better?
- Pairwise ranking of individual interactions

**Score specific attributes**
- Rate helpfulness 1-10
- Continuous scoring with custom criteria

**Iterate on rubrics**
- Start with basic criteria
- Annotate 10-20 cases
- Find disagreements with AI
- Refine rubric
- Regenerate and repeat

## What Makes This Different?

- **Trace-native**: Built for multi-step agent logs, not single LLM calls
- **Rubric-focused**: Easy to update evaluation criteria and regenerate cases
- **AI judge alignment**: See exactly where your AI judge disagrees with you
- **Format agnostic**: Works with any trace format (you write simple ingestion logic)
- **Claude-integrated**: The entire workflow is guided by Claude in the CLI

## Troubleshooting

**Servers won't start?**
- Make sure ports 8000 and 5173 are free
- Install dependencies (see Installation section)

**No test cases showing up?**
- Wait 10-30 seconds for AI pipeline to process
- Check stats to see progress: the server logs show pending → summarized → ai_annotated

**Want to start over?**
- Delete `.haize_annotations/` directory
- Or just update `feedback_config.json` via the API (archives old test cases automatically)

## Learn More

- `SKILL.md` - Full instructions Claude uses when running the workflow
- `references/` - Deep dives on ingestion patterns, rubric design, etc.
- `scripts/` - Backend implementation (FastAPI server, data models, etc.)

### Limitations
Although this is designed to be a flexible annotation workflow, there are some limitations we should still acknowledge
- traces can't be too large - they currently have to fit in an LLM call for summarization purposes
- if the source data is just missing some info (e.g. session id), theres not much we can do - the ingestion script is very basic
and can re-construct or do intelligent analysis
- this is a lightweight local tool; we cap the number of test cases generated to 100
# annotate
# annotate
