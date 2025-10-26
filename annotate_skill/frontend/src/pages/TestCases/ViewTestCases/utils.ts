import TestCases from "@/testCases/testCases.json";
import { AnnotationTestCase } from "@/types/testCases";
import * as z from "zod";

export const loadTestCases = () => {
  return z.array(AnnotationTestCase).parse(TestCases);
};
