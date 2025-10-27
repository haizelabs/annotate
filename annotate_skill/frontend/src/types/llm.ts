import * as z from "zod";

export const Message = z.object({
  role: z.string(),
  content: z.any(),
});

export const TokenUsage = z.object({
  input_tokens: z.number().nullish(),
  output_tokens: z.number().nullish(),
  total_tokens: z.number().nullish(),
});

export type Message = z.infer<typeof Message>;
export type TokenUsage = z.infer<typeof TokenUsage>;
