# Annotate

This repository contains a claude code skill to help with exploring and annotating agent trace data 

- `SKILL.md` - Full instructions Claude uses when running the workflow
- `references/` - Deep dives on ingestion patterns, rubric design, etc.
- `scripts/` - Helper scripts and a simple api server your agent uses when aiding with annotation workflows

## Quick Start

### 1. Navigate to a directory with agent traces

```bash
cd /path/to/your/agent/traces
claude
```

### 2. Trigger the skill

```
hey claude use annotate
```

Claude will guide you through:
1. **Ingesting** your raw traces into a normalized format
2. **Configuring** what you want to evaluate (pass/fail? pairwise ranking? scoring?)
3. **Annotating** based on your bespoke configuration with assistant from an AI judge

### 3. That's it!

The skill handles:
- giving claude the relevant setup scripts and tools to navigate your trace data
- distilling and filtering raw agent transcripts into the specific information relevant for annotating

## What Gets Created

When you use this skill, a `.haize_annotations/` directory is created in your working directory

```
your-project/
├── .haize_annotations/
│   ├── ingest.py              # Your custom ingestion script
│   ├── ingested_data/         # Normalized traces
│   ├── feedback_config.json   # Evaluation criteria
│   └── test_cases/            # Annotated cases
└── raw_traces.jsonl
```

All state lives here - delete it to start fresh. 

### Dependencies

The skill needs Python and Node.js dependencies:

```bash
# Install Python backend dependencies
cd /path/to/ann-cli/ann_cli/annotate
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
yarn install
```

## Limitations
- traces can't be too large - they currently have to fit in an LLM call for summarization purposes
- if the source data is just missing some info (e.g. session id), theres not much we can do - the ingestion script is very basic
and can re-construct or do intelligent analysis
- this is a lightweight local-only tool; we manually cap the number of test cases to 100 at any given time
