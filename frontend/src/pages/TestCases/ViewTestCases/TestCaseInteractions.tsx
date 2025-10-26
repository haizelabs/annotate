import { useGetTestCase } from "@/api/testCases/queries";
import { ErrorNote } from "@/components/Note";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteData } from "@/routes";
import { TestCaseType } from "@/types/testCases";
import React from "react";
import { useParams } from "react-router-dom";
import { PairwiseTraceSidebar, TraceSidebar } from "./TraceSidebar";

const TestCaseTrace = () => {
  const params: RouteData = useParams();
  const { testCaseId } = params;
  const { data, isPending, error } = useGetTestCase({ testCaseId: testCaseId! });

  if (isPending) {
    return (
      <div className="p-4">
        <Skeleton className="w-full h-8" />
      </div>
    );
  }

  if (error) {
    return <ErrorNote errorMessage={`Error loading test case: ${error.message}`} />;
  }

  const currentTestCase = data;
  if (!currentTestCase) {
    return (
      <ErrorNote
        errorMessage={`No test case found with id: ${testCaseId}. Please check the test case id in your data source and try again.`}
      />
    );
  }
  if (currentTestCase.test_case_type === TestCaseType.enum.ranking) {
    return <PairwiseTraceSidebar interactionTraces={currentTestCase.raw_judge_inputs} testCase={currentTestCase} />;
  }
  return <TraceSidebar interactionTrace={currentTestCase.raw_judge_input} testCase={currentTestCase} />;
};

export default TestCaseTrace;
