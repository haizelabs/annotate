import * as z from "zod";
import { InteractionType } from "./interactions";

export const SpecType = z.enum(["ranking", "categorical", "continuous"]);
export const LabelType = z.enum(["continuous", "categorical"]);

export const BaseLabelTypeReference = z.object({
  type: LabelType,
});

export const ContinuousLabelTypeReference = BaseLabelTypeReference.extend({
  type: z.literal(LabelType.enum.continuous),
  min_score: z.number(),
  max_score: z.number(),
});

export const CategoricalLabelTypeReference = BaseLabelTypeReference.extend({
  type: z.literal(LabelType.enum.categorical),
  categories: z.array(z.string()),
});

export const LabelTypeReference = z.discriminatedUnion("type", [
  ContinuousLabelTypeReference,
  CategoricalLabelTypeReference,
]);

export const InputItem = z.object({
  name: z.string(),
  description: z.string(),
});

export const Reference = z.object({
  type: InteractionType,
  id: z.string(),
  field: z.string().nullable(),
});

export const InputItemValue = InputItem.extend({
  value: z.string(),
  references: z.array(Reference),
});

export const RankingSpec = z.object({
  type: z.literal(SpecType.enum.ranking),
  comparison_items: z.number(),
});

export const CategoricalPointwiseSpec = z.object({
  type: z.literal(SpecType.enum.categorical),
  categories: z.array(z.string()),
});

export const ContinuousPointwiseSpec = z.object({
  type: z.literal(SpecType.enum.continuous),
  score_range: z.tuple([z.number(), z.number()]),
});

export const AnnotationSpec = z.discriminatedUnion("type", [
  RankingSpec,
  CategoricalPointwiseSpec,
  ContinuousPointwiseSpec,
]);

export const BaseAnnotation = z.object({
  annotation_id: z.string(),
  test_case_id: z.string(),
  annotator_id: z.string(),
  timestamp: z.coerce.date(),
  skip: z.boolean(),
  comment: z.string().nullable(),
});

export const RankingAnnotation = RankingSpec.extend(BaseAnnotation.shape).extend({
  rankings: z.array(z.number()),
});

export const CategoricalAnnotation = CategoricalPointwiseSpec.extend(BaseAnnotation.shape).extend({
  category: z.string(),
});

export const ContinuousAnnotation = ContinuousPointwiseSpec.extend(BaseAnnotation.shape).extend({
  score: z.number().nullable(),
});

export const Annotation = z.discriminatedUnion("type", [
  RankingAnnotation,
  CategoricalAnnotation,
  ContinuousAnnotation,
]);


export type Annotation = z.infer<typeof Annotation>;
export type LabelTypeReference = z.infer<typeof LabelTypeReference>;
export type InputItem = z.infer<typeof InputItem>;
export type InputItemValue = z.infer<typeof InputItemValue>;
export type AnnotationSpec = z.infer<typeof AnnotationSpec>;
export type RankingSpec = z.infer<typeof RankingSpec>;
export type CategoricalPointwiseSpec = z.infer<typeof CategoricalPointwiseSpec>;
export type ContinuousPointwiseSpec = z.infer<typeof ContinuousPointwiseSpec>;
export type BaseLabelTypeReference = z.infer<typeof BaseLabelTypeReference>;
export type ContinuousLabelTypeReference = z.infer<typeof ContinuousLabelTypeReference>;
export type CategoricalLabelTypeReference = z.infer<typeof CategoricalLabelTypeReference>;
export type SpecType = z.infer<typeof SpecType>;
export type LabelType = z.infer<typeof LabelType>;
export type RankingAnnotation = z.infer<typeof RankingAnnotation>;
export type CategoricalAnnotation = z.infer<typeof CategoricalAnnotation>;
export type ContinuousAnnotation = z.infer<typeof ContinuousAnnotation>;
export type BaseAnnotation = z.infer<typeof BaseAnnotation>;
export type Reference = z.infer<typeof Reference>;
