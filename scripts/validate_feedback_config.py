#!/usr/bin/env python3
"""Validate feedback_config.json using Pydantic models.

Usage:
    python validate_feedback_config.py path/to/feedback_config.json

This script:
1. Loads the JSON file
2. Validates it against the FeedbackConfig Pydantic model
3. Reports any validation errors

Call this whenever changing the feedback config to catch issues early!
"""

import argparse
import json
import sys
from pathlib import Path

from ._models import FeedbackConfig


def validate_feedback_config(config_path: Path) -> bool:
    """Validate feedback config file.

    Args:
        config_path: Path to feedback_config.json

    Returns:
        True if valid, False otherwise
    """
    print(f"🔍 Validating feedback config: {config_path}")

    # Check file exists
    if not config_path.exists():
        print(f"❌ Error: File not found: {config_path}")
        return False

    # Load JSON
    try:
        with open(config_path, "r") as f:
            config_data = json.load(f)
        print("✓ JSON loaded successfully")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

    try:
        feedback_config = FeedbackConfig(**config_data)
        print("✓ Pydantic validation passed")

        # Print summary
        print("\n📋 Feedback Config Summary:")
        print(feedback_config.model_dump_json)
        if feedback_config.feedback_spec.type == "categorical":
            print(
                f"   Categories: {', '.join(feedback_config.feedback_spec.categories)}"
            )
        elif feedback_config.feedback_spec.type == "continuous":
            print(f"   Score Range: {feedback_config.feedback_spec.score_range}")
        elif feedback_config.feedback_spec.type == "ranking":
            print(
                f"   Comparison Items: {feedback_config.feedback_spec.comparison_items}"
            )

        print("\n✅ Feedback config is valid!")
        return True

    except Exception as e:
        print(f"❌ Pydantic validation error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Validate feedback_config.json using Pydantic models"
    )
    parser.add_argument(
        "config_path", type=Path, help="Path to feedback_config.json file"
    )

    args = parser.parse_args()

    # Validate
    success = validate_feedback_config(args.config_path)

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
