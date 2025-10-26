export interface RouteData {
  testCaseId?: string;
  judgeInputIndex?: string;
  interactionStepId?: string;
}

export const joinPaths = (...paths: string[]) => {
  return paths.join("/");
};

const testCasesRoutes = () => {
  const root = "/test-cases";
  return {
    VIEW_TEST_CASES: joinPaths(root, "view"),
    VIEW_TEST_CASE: joinPaths(root, "view", ":testCaseId"),
    VIEW_TEST_CASE_AI_ANNOTATION: joinPaths(root, "view", ":testCaseId", "ai-annotation"),
    VIEW_TEST_CASE_HUMAN_ANNOTATION: joinPaths(root, "view", ":testCaseId", "human-annotation"),
    VIEW_TEST_CASE_TRACE: joinPaths(root, "view", ":testCaseId", "trace"),
    VIEW_TEST_CASE_TRACE_INTERACTION_STEP: joinPaths(root, "view", ":testCaseId", "trace", ":interactionStepId"),
    VIEW_TEST_CASE_PAIRWISE_TRACE: joinPaths(root, "view", ":testCaseId", "trace", "pairwise", ":judgeInputIndex"),
    VIEW_TEST_CASE_PAIRWISE_TRACE_INTERACTION_STEP: joinPaths(
      root,
      "view",
      ":testCaseId",
      "trace",
      "pairwise",
      ":judgeInputIndex",
      ":interactionStepId"
    ),
    view_test_case: (testCaseId: string) => {
      return {
        VIEW_TEST_CASE: joinPaths(root, "view", testCaseId),
        VIEW_TEST_CASE_AI_ANNOTATION: joinPaths(root, "view", testCaseId, "ai-annotation"),
        VIEW_TEST_CASE_HUMAN_ANNOTATION: joinPaths(root, "view", testCaseId, "human-annotation"),
        VIEW_TEST_CASE_TRACE: joinPaths(root, "view", testCaseId, "trace"),
        view_test_case_trace_interaction_step: (interactionStepId: string) => {
          return {
            VIEW_TEST_CASE_TRACE_INTERACTION_STEP: joinPaths(root, "view", testCaseId, "trace", interactionStepId),
          };
        },
        view_test_case_pairwise_trace: (judgeInputIndex: string) => {
          return {
            VIEW_TEST_CASE_PAIRWISE_TRACE: joinPaths(root, "view", testCaseId, "trace", "pairwise", judgeInputIndex),
            view_test_case_pairwise_trace_interaction_step: (interactionStepId: string) => {
              return {
                VIEW_TEST_CASE_PAIRWISE_TRACE_INTERACTION_STEP: joinPaths(
                  root,
                  "view",
                  testCaseId,
                  "trace",
                  "pairwise",
                  judgeInputIndex,
                  interactionStepId
                ),
              };
            },
          };
        },
      };
    },
  };
};

export const routes = {
  ...testCasesRoutes(),
};
