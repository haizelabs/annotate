import { BaseQueryOptions } from "@/api/query";
import { AnnotationTestCase } from "@/types/testCases";
import { useQuery } from "@tanstack/react-query";
import { getTestCase } from "./router";

export const queryKeys = {
  test_cases: ["test-cases"] as const,
  test_case: (testCaseId: string) => [...queryKeys.test_cases, testCaseId] as const,
  get_test_case: (testCaseId: string) => [...queryKeys.test_case(testCaseId), "get"] as const,
};

interface GetTestCaseArgs {
  testCaseId: string;
  options?: BaseQueryOptions<AnnotationTestCase>;
}

export const useGetTestCase = ({ testCaseId, options }: GetTestCaseArgs) => {
  return useQuery({
    queryKey: queryKeys.get_test_case(testCaseId),
    queryFn: () => getTestCase({ testCaseId }),
    ...options,
  });
};
