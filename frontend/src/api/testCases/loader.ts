import { loaderWrapper } from "@/api/loader";
import { QueryClient } from "@tanstack/react-query";
import { LoaderFunctionArgs, Params } from "react-router-dom";
import { queryKeys } from "./queries";
import { getTestCase } from "./router";

const _testCaseLoader = async (params: Params<string>) => {
  return await getTestCase({ testCaseId: params.testCaseId! });
};

const testCaseLoader =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const query = {
      queryKey: queryKeys.get_test_case(params.testCaseId!),
      queryFn: () => getTestCase({ testCaseId: params.testCaseId! }),
    };

    return queryClient.getQueryData(query.queryKey) ?? (await loaderWrapper(params, _testCaseLoader));
  };

export { testCaseLoader };
