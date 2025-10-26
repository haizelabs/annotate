import * as z from "zod";
import { Annotation, InputItemValue } from "./annotation";
import { FeedbackConfig, Granularity } from "./config";
import { Interaction, InteractionGroup, InteractionStep } from "./interactions";

export const TestCaseStatus = z.enum(["pending", "summarized", "ai_annotated", "human_annotated", "invalid"]);
export const TestCaseType = z.enum(["pointwise", "ranking"]);
export const JudgeInput = z.object({
  input_items: z.array(InputItemValue),
  raw_input: z.union([InteractionStep, Interaction, InteractionGroup]),
});

export const PointwiseAnnotationTestCase = z.object({
  test_case_id: z.string(),
  feedback_config: FeedbackConfig,
  granularity: Granularity,
  raw_judge_input: z.union([InteractionStep, Interaction, InteractionGroup]),
  status: TestCaseStatus,
  created_at: z.string(),
  updated_at: z.string(),
  judge_input: JudgeInput.nullable(),
  human_annotation: Annotation.nullable(),
  ai_annotation: Annotation.nullable(),
  test_case_type: z.literal(TestCaseType.enum.pointwise),
});

export const RankingAnnotationTestCase = z.object({
  test_case_id: z.string(),
  feedback_config: FeedbackConfig,
  raw_judge_inputs: z.array(z.union([InteractionStep, Interaction, InteractionGroup])),
  status: TestCaseStatus,
  created_at: z.string(),
  updated_at: z.string(),
  judge_inputs: z.array(JudgeInput).nullable(),
  human_annotation: Annotation.nullable(),
  ai_annotation: Annotation.nullable(),
  test_case_type: z.literal(TestCaseType.enum.ranking),
});

export const AnnotationTestCase = z.discriminatedUnion("test_case_type", [
  PointwiseAnnotationTestCase,
  RankingAnnotationTestCase,
]);

export type PointwiseAnnotationTestCase = z.infer<typeof PointwiseAnnotationTestCase>;
export type RankingAnnotationTestCase = z.infer<typeof RankingAnnotationTestCase>;
export type AnnotationTestCase = z.infer<typeof AnnotationTestCase>;
export type TestCaseStatus = z.infer<typeof TestCaseStatus>;
export type JudgeInput = z.infer<typeof JudgeInput>;
export type TestCaseType = z.infer<typeof TestCaseType>;
