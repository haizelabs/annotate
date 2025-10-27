#!/bin/bash
#
# Generate ingest.py template with imported models and boilerplate.
#
# Usage:
#   bash scripts/generation_ingestion_script.sh <output_path>
#
# Example:
#   bash scripts/generation_ingestion_script.sh ./ingest.py
#   bash scripts/generation_ingestion_script.sh /path/to/project/ingest.py
#
# This creates ingest.py with:
# - Part 1: Header with docstring and description
# - Part 2: Import statements for all Pydantic models from scripts/_models.py
# - Part 3: Placeholder ingest() function and main() execution logic

set -e

# Check if output path argument is provided
if [ $# -eq 0 ]; then
    echo "Error: Output path is required"
    echo ""
    echo "Usage: bash scripts/generation_ingestion_script.sh <output_path>"
    echo ""
    echo "Examples:"
    echo "  bash scripts/generation_ingestion_script.sh ./ingest.py"
    echo "  bash scripts/generation_ingestion_script.sh /path/to/project/ingest.py"
    exit 1
fi

OUTPUT_FILE="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Create output directory if it doesn't exist
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
mkdir -p "$OUTPUT_DIR"

echo "Generating $OUTPUT_FILE in 3 parts..."
echo "   Part 1: Header and docstring"
echo "   Part 2: Model imports from _models.py"
echo "   Part 3: ingest() template and main() logic"

# PART 1: Header and Docstring
cat > "$OUTPUT_FILE" << 'EOF'
#!/usr/bin/env python3
"""
Normalize raw traces into the annotation workflow format.

This script imports all necessary models from scripts._models and provides
a template for implementing custom ingestion logic.

TODO: Implement the ingest() function below based on your trace format.
      You're responsible for ALL file loading and parsing logic.
"""

# Standard library imports
import argparse
import json
from pathlib import Path
from typing import Optional

EOF

# PART 2: Copy raw model definitions from _models.py
# This makes the generated script fully standalone and portable
cat "$SCRIPT_DIR/_models.py" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"  # Add blank line separator

# PART 3: User Implementation Section
cat >> "$OUTPUT_FILE" << 'EOF'
# =============================================================================
# YOUR CUSTOM INGESTION LOGIC
# =============================================================================


def ingest(folder_path: str) -> list[Interaction]:
    """
    Convert raw traces from folder_path into normalized Interaction objects.

    This is where YOU implement your custom logic to:
    1. Load and parse your raw trace files
    2. Extract relevant data (spans, messages, LLM calls, etc.)
    3. Convert to InteractionStep objects
    4. Group steps into Interaction objects

    Args:
        folder_path: Path to directory containing raw trace files

    Returns:
        List of Interaction objects

    Example structure:
        [
            Interaction(
                id="trace_abc123",
                name="User request",
                steps=[
                    InteractionStep(id="step1", name="LLM call", ...),
                    InteractionStep(id="step2", name="Tool call", ...),
                ],
                ...
            ),
            ...
        ]
    """
    # TODO: Implement your custom ingestion logic here!
    #
    # Tips:
    # - Use Path(folder_path).glob("*.json") to find trace files
    # - Parse each file and extract span/event data
    # - Create InteractionStep for each span
    # - Group steps by trace_id/conversation_id into Interactions
    # - Return list[Interaction]

    raise NotImplementedError(
        "Please implement the ingest() function based on your trace format. "
        "See references/normalization_patterns.md for examples."
    )


# =============================================================================
# MAIN EXECUTION LOGIC (No changes needed)
# =============================================================================


def main():
    """
    Main execution: call ingest() and save interactions to filesystem.
    """
    parser = argparse.ArgumentParser(
        description="Normalize traces into annotation workflow format"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to folder containing raw traces"
    )
    parser.add_argument(
        "--output-dir",
        default=".haize_annotations/ingested_data/interactions",
        help="Output directory for ingested interactions",
    )
    args = parser.parse_args()

    # Call generated ingest function
    print(f"Loading and normalizing traces from {args.input}...")
    try:
        interactions = ingest(args.input)
    except NotImplementedError as e:
        print(f"\nError: {e}")
        print("\nPlease implement the ingest() function in this script.")
        print("See SKILL.md Phase 1 for guidance.")
        return

    print(f"\nFound {len(interactions)} interactions")

    # Save each interaction to filesystem
    print(f"Saving interactions to {args.output_dir}...")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for interaction in interactions:
        interaction_path = output_dir / interaction.id
        interaction.save(str(interaction_path))

    print(f"\nComplete! Saved {len(interactions)} interactions to {output_dir}")
    print(f"\nNext steps:")
    print(f"  1. Validate: python scripts/validate_ingested_data.py --ingested-dir {args.output_dir} --verbose")
    print(f"  2. Create feedback config")
    print(f"  3. Extract judge inputs")


if __name__ == "__main__":
    main()
EOF

# Make executable
chmod +x "$OUTPUT_FILE"

echo ""
echo "Successfully generated $OUTPUT_FILE"
echo ""
echo "The generated script has 3 parts:"
echo "   1. Header with docstring"
echo "   2. Imports from scripts._models (no code duplication!)"
echo "   3. ingest() template + main() execution logic"
echo ""
echo "Next steps:"
echo "  1. Edit $OUTPUT_FILE and implement the ingest(folder_path) function"
echo "  2. Run: python $OUTPUT_FILE --input /path/to/traces/folder"
echo ""
