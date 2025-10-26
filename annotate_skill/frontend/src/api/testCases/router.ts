import { api } from "@/api/api";
import { parseResponse } from "@/api/utils";
import { joinPaths } from "@/routes";
import { AnnotationTestCase } from "@/types/testCases";

const prefix = "/test-cases";

export const getTestCase = async ({ testCaseId }: { testCaseId: string }) => {
  const path = joinPaths(prefix, testCaseId);
  const response = await api.get(path);
  return parseResponse(response, AnnotationTestCase);
};
