# Annotate

## Overview

This repository contains a custom Claude Code [skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) to help with exploring and annotating agent trace data.

- `SKILL.md` - Full instructions Claude uses when running the workflow
- `references/` - Deep dives on ingestion patterns, rubric design, etc.
- `scripts/` - Helper scripts and a simple API server your agent uses when aiding with annotation workflows

## Quick Start


### 1. Install the skill

```bash
# Create and activate virtual environment
uv venv
source .venv/bin/activate

# Clone the repository
git clone git@github.com:haizelabs/annotate.git

# Move skill to Claude skills directory
mv annotate/annotate_skill ~/.claude/skills/annotate_skill
cd ~/.claude/skills/annotate_skill

# Install dependencies
pip install -r requirements.txt
cd frontend && yarn install && cd ..
```

### 2. Navigate to a directory with agent traces

```bash
# If you don't have logs yet, use the example data:
cd /Users/haizelabsguest/haizelabs/osource-aa/annotate/tests/example_research_agent

# OR navigate to your own agent traces directory:
# cd /path/to/your/agent/data

# Set your API key (required for AI judge setup)
export OPENAI_API_KEY=...

# Start Claude Code
claude
```

> **Note:** Any [supported Pydantic AI model](https://ai.pydantic.dev/models/overview/) can power this tool. To change the underlying model, set the `HAIZE_ANNOTATE_MODEL_NAME` environment variable, e.g. `"openai:gpt-4.1"`

### 3. Trigger the skill

Once Claude Code is running, activate the skill:

```
> hey claude use annotate
```

Claude will guide you through:
1. **Ingesting** your raw traces into a normalized format
2. **Configuring** what you want to evaluate (pass/fail? pairwise ranking? scoring?)
3. **Annotating** based on your bespoke configuration with assistant from an AI judge

The skill handles:
- giving Claude the relevant setup scripts and tools to navigate your trace data
- distilling and filtering raw agent transcripts into the specific information relevant for annotating

### ⚠️ Important Notes

**Browser Interaction:** Claude will automatically open an AI interaction visualizer in your browser during the annotation process. This visualizer provides a detailed view of the agent's interactions and decisions. **Use this as your reference** when providing feedback, as it shows the full context of what the AI agent did.

**Code execution:** During the ingestion phase, Claude will generate a custom `ingest.py` script containing a `ingest()` function that transforms your raw trace data. **You must review this generated code before execution** - it will write custom parsing logic based on your specific data format. Only run the script if you understand what it's doing and agree with the transformation logic.

## What Gets Created

When you use this skill, a `.haize_annotations/` directory is created in your working directory

```
your-project/
├── .haize_annotations/
│   ├── ingest.py              # Custom ingestion script
│   ├── ingested_data/         # Ingested agent interactions
│   ├── feedback_config.json   # Evaluation criteria
│   └── test_cases/            # Annotated cases
└── <your-raw-traces.jsonl>
```

All state lives here - delete it to start fresh. 

### Dependencies

The skill needs Python and Node.js dependencies:

```bash
# Install Python backend dependencies
cd ~/.claude/skills/annotate

# Create and activate virtual environment (if not already done)
uv venv
source .venv/bin/activate

pip install -r requirements.txt

# Install frontend dependencies
(cd frontend && yarn install)
```

## Limitations
- Traces can't be too large - they currently have to fit in an LLM call for summarization purposes
- If the source data is just missing some info (e.g. session id), there's not much we can do - the ingestion script is very basic and cannot re-construct or do intelligent analysis
- This is a lightweight local-only tool; we manually cap the number of test cases to 100 at any given time
