import * as z from "zod";
import { Message, TokenUsage } from "./llm";

export const InteractionStepType = z.enum(["LLM_CALL", "FUNCTION_CALL", "TOOL_CALL", "ROOT"]);

export const InteractionStep = z.object({
  id: z.string(),
  parent_step_id: z.string().nullable(),
  interaction_id: z.string().nullable(),
  group_id: z.string().nullable(),
  name: z.string().nullable(),
  start_ns: z.number().nullable(),
  duration_ns: z.number().nullable(),
  input_data: z.any().nullable(),
  output_data: z.any().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  raw: z.record(z.string(), z.unknown()).nullable(),
  model: z.string().nullable(),
  input_messages: z.array(Message).nullable(),
  output_messages: z.array(Message).nullable(),
  usage: TokenUsage.nullable(),
  provider: z.string().nullable(),
  response_id: z.string().nullable(),
});

export const Interaction = z.object({
  id: z.string(),
  steps: z.array(InteractionStep),
  start_ns: z.number().nullable(),
  group_id: z.string().nullable(),
  duration_ns: z.number().nullable(),
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
