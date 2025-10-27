import * as z from "zod";
import { Message, TokenUsage } from "./llm";

export const InteractionStepType = z.enum(["LLM_CALL", "FUNCTION_CALL", "TOOL_CALL", "ROOT"]);

export const InteractionStep = z.object({
  id: z.string(),
  parent_step_id: z.string().nullish(),
  interaction_id: z.string().nullish(),
  group_id: z.string().nullish(),
  name: z.string().nullish(),
  start_ns: z.number().nullish(),
  duration_ns: z.number().nullish(),
  input_data: z.any().nullish(),
  output_data: z.any().nullish(),
  metadata: z.record(z.string(), z.any()).default({}),
  raw: z.record(z.string(), z.any()).default({}),
  model: z.string().nullish(),
  input_messages: z.array(Message).nullish(),
  output_messages: z.array(Message).nullish(),
  usage: TokenUsage.nullish(),
  provider: z.string().nullish(),
  response_id: z.string().nullish(),
  tags: z.record(z.string(), z.string()).nullish().optional(),
});

export const Interaction = z.object({
  id: z.string(),
  steps: z.array(InteractionStep),
  start_ns: z.number().nullish(),
  group_id: z.string().nullish(),
  duration_ns: z.number().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  tags: z.record(z.string(), z.any()).default({}),
});

export const InteractionGroup = z.object({
  id: z.string(),
  interactions: z.array(Interaction),
});

export const InteractionType = z.enum(["step", "interaction", "group"]);

export type InteractionType = z.infer<typeof InteractionType>;
export type InteractionStepType = z.infer<typeof InteractionStepType>;
export type InteractionStep = z.infer<typeof InteractionStep>;
export type Interaction = z.infer<typeof Interaction>;
export type InteractionGroup = z.infer<typeof InteractionGroup>;
