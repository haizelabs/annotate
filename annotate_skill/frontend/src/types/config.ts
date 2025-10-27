import * as z from "zod";
import { AnnotationSpec, InputItem } from "./annotation";

export const Granularity = z.enum(["step", "interaction", "group"]);

export const AttributeMatcher = z.object({
  attribute_path: z.string(),
  contains_str: z.string().nullable(),
  matches_regex: z.string().nullable(),
  equals_value: z.any().nullable(),
});

export const FeedbackConfig = z.object({
  id: z.string(),
  granularity: Granularity,
  disqualification_criteria: z.string().nullable(),
  requires_context: z.literal([Granularity.enum.group, Granularity.enum.interaction]).nullable(),
  feedback_spec: AnnotationSpec,
  input_items: z.array(InputItem),
  ai_rubric: z.string(),
  attribute_matchers: z.array(AttributeMatcher),
  natural_language_disqualifier: z.string().nullable(),
  interaction_join_id: z.string().optional(),
  group_join_id: z.string().optional(),
});

export const FeedbackConfigState = z.object({
  feedback_config: FeedbackConfig,
  ai_rubric: z.string(),
});

export const MappingConfig = z.object({
  step_array_path: z.string(),
  field_mappings: z.record(z.string(), z.any()),
  llm_fields: z.record(z.string(), z.any()),
});

export type MappingConfig = z.infer<typeof MappingConfig>;
export type FeedbackConfig = z.infer<typeof FeedbackConfig>;
export type FeedbackConfigState = z.infer<typeof FeedbackConfigState>;
export type Granularity = z.infer<typeof Granularity>;
export type AttributeMatcher = z.infer<typeof AttributeMatcher>;
