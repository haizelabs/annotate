#!/usr/bin/env python3
"""
Validate ingested data in filesystem structure.

This is a standalone script - no imports from skill library needed.
It reads interactions from the filesystem and validates structure.

Usage:
    python scripts/validate_ingested_data.py \\
        --ingested-dir .haize_annotations/ingested_data/interactions \\
        --verbose
"""

import argparse
import random
import json
from pathlib import Path
from collections import Counter, defaultdict
from pydantic import ValidationError

from ._models import InteractionStep


def load_interaction(interaction_dir: Path) -> tuple[dict, list[InteractionStep]]:
    with open(interaction_dir / "metadata.json", "r") as f:
        metadata = json.load(f)

    steps = []
    with open(interaction_dir / "steps.jsonl", "r") as f:
        for line in f:
            if line.strip():
                step_data = json.loads(line)
                try:
                    step = InteractionStep(**step_data)
                    steps.append(step)
                except ValidationError as e:
                    raise ValidationError(
                        f"Invalid step in {interaction_dir.name}: {e}"
                    )

    return metadata, steps


def validate_ingested_filesystem(ingested_dir: Path, verbose: bool = False) -> dict:
    """
    Validate ingested data stored in filesystem.

    Args:
        ingested_dir: Directory containing interaction subdirectories
        verbose: Print detailed samples

    Returns:
        Dictionary of validation results and statistics
    """
    results = {"valid": True, "errors": [], "warnings": [], "stats": {}}

    if not ingested_dir.exists():
        results["valid"] = False
        results["errors"].append(f"Directory not found: {ingested_dir}")
        return results

    # Find all interaction directories
    interaction_dirs = [d for d in ingested_dir.iterdir() if d.is_dir()]

    if not interaction_dirs:
        results["valid"] = False
        results["errors"].append("No interaction directories found")
        return results

    print(f"Found {len(interaction_dirs)} interaction directories")

    # Load and validate each interaction
    interactions_metadata = []
    all_steps = []
    load_errors = []

    for interaction_dir in interaction_dirs:
        try:
            metadata, steps = load_interaction(interaction_dir)
            interactions_metadata.append(metadata)
            all_steps.extend(steps)
        except Exception as e:
            load_errors.append(f"{interaction_dir.name}: {e}")

    if load_errors:
        results["warnings"].extend(load_errors)
        if len(load_errors) == len(interaction_dirs):
            results["valid"] = False
            results["errors"].append("Failed to load all interactions")
            return results

    total_steps = len(all_steps)
    num_interactions = len(interactions_metadata)

    results["stats"]["total_steps"] = total_steps
    results["stats"]["num_interactions"] = num_interactions

    if num_interactions > 0:
        results["stats"]["avg_steps_per_interaction"] = total_steps / num_interactions
    else:
        results["stats"]["avg_steps_per_interaction"] = 0

    # Group-level statistics
    group_ids = [m.get("group_id") for m in interactions_metadata if m.get("group_id")]
    unique_groups = len(set(group_ids))
    results["stats"]["num_groups"] = unique_groups

    if unique_groups > 0:
        # Interactions per group
        interactions_by_group = defaultdict(list)
        for metadata in interactions_metadata:
            if metadata.get("group_id"):
                interactions_by_group[metadata["group_id"]].append(metadata["id"])

        interactions_per_group = [len(ints) for ints in interactions_by_group.values()]
        results["stats"]["avg_interactions_per_group"] = sum(
            interactions_per_group
        ) / len(interactions_per_group)
    else:
        results["stats"]["avg_interactions_per_group"] = 0

    # Root spans (steps with no parent)
    root_steps = [s for s in all_steps if not s.parent_step_id]
    results["stats"]["root_steps"] = len(root_steps)

    # LLM-specific statistics
    llm_steps = [s for s in all_steps if s.model]
    results["stats"]["llm_calls"] = len(llm_steps)

    if llm_steps:
        models = [s.model for s in llm_steps if s.model]
        model_counts = dict(Counter(models))
        results["stats"]["models_used"] = model_counts

    # Field coverage
    field_coverage = {
        "id": sum(1 for s in all_steps if s.id),
        "name": sum(1 for s in all_steps if s.name),
        "interaction_id": sum(1 for s in all_steps if s.interaction_id),
        "parent_step_id": sum(1 for s in all_steps if s.parent_step_id),
        "input_data": sum(1 for s in all_steps if s.input_data),
        "output_data": sum(1 for s in all_steps if s.output_data),
        "model": sum(1 for s in all_steps if s.model),
    }

    results["stats"]["field_coverage_pct"] = {
        field: f"{(count / total_steps) * 100:.1f}%"
        for field, count in field_coverage.items()
    }

    # Check for orphaned parent references
    step_ids = {s.id for s in all_steps}
    orphaned = [
        s for s in all_steps if s.parent_step_id and s.parent_step_id not in step_ids
    ]

    if orphaned:
        results["warnings"].append(
            f"{len(orphaned)} steps reference non-existent parent_step_id"
        )

    if verbose and interactions_metadata:
        print("\n" + "=" * 80)
        print("SAMPLE INTERACTIONS (5 random)")
        print("=" * 80)

        sample_dirs = random.sample(interaction_dirs, min(5, len(interaction_dirs)))

        for interaction_dir in sample_dirs:
            try:
                metadata, steps = load_interaction(interaction_dir)

                print(f"\nInteraction ID: {metadata['id']}")
                if metadata.get("name"):
                    print(f"  Name: {metadata['name']}")
                if metadata.get("group_id"):
                    print(f"  Group ID: {metadata['group_id']}")
                print(f"  Steps: {len(steps)}")

                # Show first 2 steps
                for i, step in enumerate(steps[:2]):
                    print(f"\n  Step {i+1}: {step.id}")
                    if step.name:
                        print(f"    Name: {step.name}")
                    if step.model:
                        print(f"    Model: {step.model}")
                    if step.input_data:
                        input_preview = str(step.input_data)[:100]
                        print(f"    Input: {input_preview}...")
                    if step.output_data:
                        output_preview = str(step.output_data)[:100]
                        print(f"    Output: {output_preview}...")

                if len(steps) > 2:
                    print(f"\n  ... and {len(steps) - 2} more steps")
            except Exception as e:
                print(f"\n  Error loading sample: {e}")

    return results


def print_results(results: dict):
    """Print validation results in a readable format."""
    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)

    if results["errors"]:
        print("\n❌ ERRORS:")
        for error in results["errors"]:
            print(f"  - {error}")

    if results["warnings"]:
        print("\n⚠️  WARNINGS:")
        for warning in results["warnings"]:
            print(f"  - {warning}")

    if results["valid"]:
        print("\n✅ VALIDATION PASSED")
    else:
        print("\n❌ VALIDATION FAILED")

    print("\n" + "=" * 80)
    print("STATISTICS")
    print("=" * 80)

    stats = results["stats"]

    print("\n📊 Overview:")
    print(f"  Total Steps: {stats.get('total_steps', 0):,}")
    print(f"  Interactions: {stats.get('num_interactions', 0):,}")
    print(f"  Avg Steps/Interaction: {stats.get('avg_steps_per_interaction', 0):.2f}")

    if stats.get("num_groups", 0) > 0:
        print(f"  Interaction Groups: {stats['num_groups']:,}")
        print(f"  Avg Interactions/Group: {stats['avg_interactions_per_group']:.2f}")

    print(f"  Root Spans: {stats.get('root_steps', 0):,}")

    if stats.get("llm_calls", 0) > 0:
        print(f"  LLM Calls: {stats['llm_calls']:,}")

    if "models_used" in stats:
        print("\n📱 Models Used:")
        for model, count in stats["models_used"].items():
            print(f"  - {model}: {count:,}")

    if "field_coverage_pct" in stats:
        print("\n📋 Field Coverage:")
        for field, pct in stats["field_coverage_pct"].items():
            print(f"  - {field}: {pct}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate ingested data in filesystem structure"
    )
    parser.add_argument(
        "--ingested-dir",
        required=True,
        help="Directory containing ingested interactions",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show detailed samples of interactions"
    )

    args = parser.parse_args()

    ingested_dir = Path(args.ingested_dir)

    results = validate_ingested_filesystem(ingested_dir, args.verbose)

    print_results(results)


if __name__ == "__main__":
    main()
