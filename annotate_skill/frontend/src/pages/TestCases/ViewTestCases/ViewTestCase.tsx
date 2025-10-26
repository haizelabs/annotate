import { useGetTestCase } from "@/api/testCases/queries";
import { CollapsibleDetailField } from "@/components/CollapsibleContent";
import { DataTable } from "@/components/Datatable";
import { ErrorNote } from "@/components/Note";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RouteData, routes } from "@/routes";
import { InputItemValue, Reference } from "@/types/annotation";
import {
  AnnotationTestCase,
  JudgeInput,
  PointwiseAnnotationTestCase,
  RankingAnnotationTestCase,
  TestCaseType,
} from "@/types/testCases";
import { Granularity } from "@app/types/config";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import React, { createContext, useContext } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

interface TestCaseContext {
  testCase: AnnotationTestCase;
  granularity: Granularity;
  judgeInputIndex?: number;
}

// Context to pass test case granularity down to reference cells
const TestCaseGranularityContext = createContext<TestCaseContext | null>(null);

const useTestCaseGranularity = () => {
  const context = useContext(TestCaseGranularityContext);
  if (!context) {
    throw new Error("useTestCaseGranularity must be used within a TestCaseGranularityContext");
  }
  return context;
};

// Determine if reference goes deeper than test case granularity
// Granularity hierarchy: group > interaction > step
const shouldShowReference = (testCaseGranularity: string, referenceType: string): boolean => {
  // Always show references for steps
  if (referenceType === "step") {
    return true;
  }

  const hierarchy = ["group", "interaction", "step"];
  const testCaseLevel = hierarchy.indexOf(testCaseGranularity);
  const referenceLevel = hierarchy.indexOf(referenceType);

  // Show if reference is more granular (higher index) than test case
  return referenceLevel > testCaseLevel;
};

const referenceColumns: ColumnDef<Reference>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      return (
        <Tag variant={row.original.type}>
          <p className="text-xs">{row.original.type}</p>
        </Tag>
      );
    },
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      return <div>{row.original.id}</div>;
    },
  },
  {
    accessorKey: "field",
    header: "Field",
    cell: ({ row }) => {
      return <div>{row.original.field}</div>;
    },
  },
  {
    id: "action",
    header: "",
    cell: ({ row }) => {
      const params: RouteData = useParams();
      const { granularity, testCase, judgeInputIndex } = useTestCaseGranularity();
      const navigate = useNavigate();

      const { testCaseId } = params;
      const reference = row.original;

      // Hide button if reference doesn't go deeper than test case granularity
      if (!granularity || !shouldShowReference(granularity, reference.type)) {
        return null;
      }

      return (
        <Button
          variant="ghost"
          size="sm"
          className="shadow-none gap-2"
          onClick={() => {
            if (testCase.test_case_type === TestCaseType.enum.ranking) {
              navigate(
                routes
                  .view_test_case(testCaseId!)
                  .view_test_case_pairwise_trace(judgeInputIndex?.toString() ?? "0")
                  .view_test_case_pairwise_trace_interaction_step(reference.id)
                  .VIEW_TEST_CASE_PAIRWISE_TRACE_INTERACTION_STEP
              );
            } else {
              navigate(
                routes.view_test_case(testCaseId!).view_test_case_trace_interaction_step(reference.id)
                  .VIEW_TEST_CASE_TRACE_INTERACTION_STEP
              );
            }
          }}
        >
          <Eye className="w-4 h-4" />
          View Reference
        </Button>
      );
    },
  },
];

const ViewReferences = ({ references }: { references: Reference[] }) => {
  // Check if any reference has a meaningful ID
  const hasReferenceIds = references.some((ref) => ref.id && ref.id.trim() !== "");

  // Filter columns based on whether IDs exist
  const columns = hasReferenceIds ? referenceColumns : referenceColumns.filter((col) => col.accessorKey !== "id");

  return (
    <CollapsibleDetailField title="References" showSeparator={false} open={false}>
      <DataTable columns={columns} data={references} />
    </CollapsibleDetailField>
  );
};

const ViewInputItem = ({ inputItem }: { inputItem: InputItemValue }) => {
  return (
    <div className="flex flex-col border rounded-sm">
      <div className="p-4 pb-4 border-b space-y-1.5">
        <h2 className="font-mono font-semibold">{inputItem.name}</h2>
        <p className="text-sm text-muted-foreground">{inputItem.description}</p>
        <ViewReferences references={inputItem.references} />
      </div>
      <div className="p-4">
      <p className="text-sm whitespace-pre-wrap">{inputItem.value}</p>
      </div>
    </div>
  );
};

const ViewJudgeInput = ({ judgeInput }: { judgeInput: JudgeInput }) => {
  const inputItems = judgeInput.input_items;
  return (
    <div className="flex flex-col gap-6">
      {inputItems.map((inputItem) => (
        <ViewInputItem inputItem={inputItem} key={inputItem.name} />
      ))}
    </div>
  );
};

const ViewPointwiseTestCase = ({ testCase }: { testCase: PointwiseAnnotationTestCase }) => {
  if (!testCase.judge_input) {
    return <ErrorNote errorMessage="No judge input found" />;
  }

  return (
    <TestCaseGranularityContext.Provider value={{ testCase, granularity: testCase.feedback_config.granularity }}>
      <ViewJudgeInput judgeInput={testCase.judge_input} />
    </TestCaseGranularityContext.Provider>
  );
};

const ViewRankingTestCase = ({ testCase }: { testCase: RankingAnnotationTestCase }) => {
  if (!testCase.judge_inputs) {
    return <ErrorNote errorMessage="No judge inputs found" />;
  }

  const numJudgeInputs = testCase.judge_inputs.length;
  return (
    <div
      className={cn("grid")}
      style={{
        gridTemplateColumns: `repeat(${numJudgeInputs}, 1fr)`,
      }}
    >
      {testCase.judge_inputs.map((judgeInput, index) => (
        <TestCaseGranularityContext.Provider
          value={{ testCase, granularity: testCase.feedback_config.granularity, judgeInputIndex: index }}
          key={index}
        >
          <div className="border-l first:border-l-0 flex flex-col">
            <div className="border-b h-12 flex items-center px-4 bg-muted/30">
              <h2 className="font-semibold text-sm">Input {index}</h2>
            </div>
            <div className="p-4">
              <ViewJudgeInput judgeInput={judgeInput} />
            </div>
          </div>
        </TestCaseGranularityContext.Provider>
      ))}
    </div>
  );
};

const TestCaseDetails = ({ testCase }: { testCase: AnnotationTestCase }) => {
  if (testCase.test_case_type === TestCaseType.enum.pointwise) {
    return <ViewPointwiseTestCase testCase={testCase} />;
  }
  return <ViewRankingTestCase testCase={testCase} />;
};

const CustomTabTrigger = ({ children, value }: { children: React.ReactNode; value: string }) => {
  return (
    <TabsTrigger
      className="h-12 hover:cursor-pointer hover:bg-stone-100 data-[state=active]:hover:bg-stone-100 shadow-none rounded-none border-b border-transparent data-[state=active]:border-b data-[state=active]:border-black data-[state=active]:shadow-none"
      value={value}
    >
      {children}
    </TabsTrigger>
  );
};

const TestCaseSideBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params: RouteData = useParams();
  const { testCaseId } = params;
  const pathname = location.pathname;

  // Determine current tab based on path
  let value = "trace";
  if (pathname.includes("ai-annotation")) {
    value = "ai-annotation";
  } else if (pathname.includes("human-annotation")) {
    value = "human-annotation";
  }

  return (
    <Tabs
      defaultValue={value}
      value={value}
      className="h-full min-h-0 overflow-hidden"
      onValueChange={(value) => {
        if (value === "ai-annotation") {
          navigate(routes.view_test_case(testCaseId!).VIEW_TEST_CASE_AI_ANNOTATION);
        } else if (value === "human-annotation") {
          navigate(routes.view_test_case(testCaseId!).VIEW_TEST_CASE_HUMAN_ANNOTATION);
        } else {
          navigate(routes.view_test_case(testCaseId!).VIEW_TEST_CASE_TRACE);
        }
      }}
    >
      <TabsList className="bg-transparent shadow-none p-0 rounded-none w-full justify-start border-b border-b-stone-200 px-4 h-12">
        <CustomTabTrigger value="trace">Trace</CustomTabTrigger>
        <CustomTabTrigger value="ai-annotation">AI Annotation</CustomTabTrigger>
        <CustomTabTrigger value="human-annotation">Human Annotation</CustomTabTrigger>
      </TabsList>
      <TabsContent value="trace" className="h-full mt-0 flex flex-col min-h-0">
        <Outlet />
      </TabsContent>
      <TabsContent value="ai-annotation" className="h-full mt-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <Outlet />
        </div>
      </TabsContent>
      <TabsContent value="human-annotation" className="h-full mt-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <Outlet />
        </div>
      </TabsContent>
    </Tabs>
  );
};

const ViewTestCase = () => {
  const params: RouteData = useParams();
  const { testCaseId } = params;

  const { data, isPending, error } = useGetTestCase({ testCaseId: testCaseId!, options: { enabled: !!testCaseId } });

  if (!testCaseId) return <div className="p-4">No test case id found</div>;
  if (isPending) return <div className="p-4">Loading...</div>;

  if (error)
    return (
      <div className="p-4">
        <ErrorNote errorMessage={`Error loading test case: ${error.message}`} />
      </div>
    );

  const currentTestCase = data;

  const pathname = location.pathname;
  const isAIAnnotation = pathname.includes("ai-annotation");
  const isHumanAnnotation = pathname.includes("human-annotation");
  const isTrace = pathname.includes("trace");

  if (!currentTestCase) {
    return (
      <div className="p-4">
        <ErrorNote
          errorMessage={`No test case found with id: ${testCaseId}. Please check the test case id in your data source and try again.`}
        />
      </div>
    );
  }

  if (!isAIAnnotation && !isHumanAnnotation && !isTrace) {
    return <Navigate to={routes.view_test_case(currentTestCase.test_case_id).VIEW_TEST_CASE_TRACE} />;
  }

  return (
    <div className="overflow-hidden flex min-h-screen max-h-screen w-full flex-col bg-background">
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={65} minSize={45} className="min-h-0">
          <div className="h-full min-h-0 overflow-auto bg-card">
            <div className="border-b h-12 flex items-center px-4">
              <h1 className="font-semibold text-lg">Judge Input</h1>
            </div>
            <TestCaseDetails testCase={currentTestCase} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={25} className="min-h-0">
          <TestCaseSideBar />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default ViewTestCase;
