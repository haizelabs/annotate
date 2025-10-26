from __future__ import annotations
from collections import defaultdict
from ._models import InteractionStep, Interaction, InteractionGroup


def build_interaction_objects(steps: list[InteractionStep]) -> list[Interaction]:
    grouped_steps: dict[str, list[InteractionStep]] = defaultdict(list)

    for step in steps:
        join_value = step.interaction_id
        if join_value is not None:
            grouped_steps[str(join_value)].append(step)

    interactions: list[Interaction] = []
    for interaction_id, interaction_steps in grouped_steps.items():
        sorted_steps = sorted(
            interaction_steps, key=lambda s: s.start_ns if s.start_ns else float("inf")
        )

        start_ns = None
        duration_ns = None
        if sorted_steps:
            valid_starts = [s.start_ns for s in sorted_steps if s.start_ns is not None]
            if valid_starts:
                start_ns = min(valid_starts)

            valid_durations = [
                s.duration_ns for s in sorted_steps if s.duration_ns is not None
            ]
            if valid_durations:
                duration_ns = sum(valid_durations)

        group_id = None
        for step in interaction_steps:
            if step.group_id is not None:
                group_id = step.group_id
                break

        interactions.append(
            Interaction(
                id=interaction_id,
                steps=sorted_steps,
                start_ns=start_ns,
                duration_ns=duration_ns,
                group_id=group_id,
            )
        )
    return interactions


def build_interaction_groups(
    steps: list[InteractionStep],
) -> list[InteractionGroup]:
    interactions = build_interaction_objects(steps)

    groups_dict: dict[str, list[Interaction]] = defaultdict(list)
    for interaction in interactions:
        group_key = (
            str(interaction.group_id)
            if interaction.group_id is not None
            else "default_group"
        )
        groups_dict[group_key].append(interaction)

    groups: list[InteractionGroup] = []
    for group_id, group_interactions in groups_dict.items():
        groups.append(
            InteractionGroup(
                joined_on="group_id", id=group_id, interactions=group_interactions
            )
        )
    return groups
