import { useGetInteractionForStep } from "@/api/interactions/queries";
import { CollapsibleDetailField } from "@/components/CollapsibleContent";
import { Icon, spanColors } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, round, stringifyDataType } from "@/lib/utils";
import { RouteData, routes } from "@/routes";
import { Interaction, InteractionGroup, InteractionStep, InteractionStepType } from "@/types/interactions";
import { AnnotationTestCase, TestCaseType } from "@/types/testCases";
import { json } from "@codemirror/lang-json";
import { githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { ChevronRight } from "lucide-react";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type SpanTreeNode = InteractionStep & { children: SpanTreeNode[] };

const VerticalConnector = ({ lineHeight, left }: { lineHeight: number; left: number }) => {
  return (
    <div
      className="absolute bg-neutral-300 top-3 z-10"
      style={{
        height: `calc(${lineHeight}px - 1rem)`,
        width: "1px",
        transform: `translateX(${left}px)`,
      }}
    />
  );
};

const HorizontalConnector = ({ height, width, left }: { height: number; width: number; left: number }) => {
  return (
    <div
      className="absolute rounded-bl border border-neutral-300 border-t-0 border-r-0 -top-[3px] z-10"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translateX(${left}px)`,
      }}
    />
  );
};

const isSingleStep = (interactionTrace: InteractionStep | Interaction | InteractionGroup): boolean => {
  return !("steps" in interactionTrace) && !("interactions" in interactionTrace);
};

const parseInteractionTrace = (interactionTrace: InteractionStep | Interaction | InteractionGroup) => {
  if ("steps" in interactionTrace) {
    return buildSpanTree(interactionTrace.steps);
  }
  if ("interactions" in interactionTrace) {
    return buildSpanTree(interactionTrace.interactions.map((interaction) => interaction.steps).flat());
  }
  return buildSpanTree([interactionTrace]);
};

const buildSpanTree = (steps: InteractionStep[]) => {
  const nodeMap = new Map<string, SpanTreeNode>();
  const interactionIds = new Set<string>();
  const roots: SpanTreeNode[] = [];
  steps
    .slice()
    .sort((a, b) => (a.start_ns ?? 0) - (b.start_ns ?? 0))
    .forEach((step) => {
      nodeMap.set(step.id, { ...step, children: [] });
      if (step.interaction_id) {
        interactionIds.add(step.interaction_id);
      }
    });

  nodeMap.forEach((node) => {
    if (node.parent_step_id && nodeMap.has(node.parent_step_id)) {
      nodeMap.get(node.parent_step_id)!.children.push(node);
    } else if (node.interaction_id && interactionIds.has(node.interaction_id)) {
      if (node.id !== node.interaction_id) {
        // edge case where the step id is the root of the interaction
        const interactionNode = nodeMap.get(node.interaction_id);
        if (interactionNode) {
          interactionNode.children.push(node);
        } else {
          // interaction_id is just a grouping ID, treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    } else {
      // No parent and no valid interaction - treat as root
      roots.push(node);
    }
  });

  const sortChildren = (nodes: SpanTreeNode[]) => {
    nodes.sort((a, b) => (a.start_ns ?? 0) - (b.start_ns ?? 0));
    nodes.forEach((child) => sortChildren(child.children));
  };

  sortChildren(roots);

  return {
    nodeMap,
    tree: [
      {
        id: "root",
        interaction_id: "root",
        group_id: null,
        name: "AI Interaction",
        start_ns: null,
        model: null,
        input_messages: null,
        output_messages: null,
        usage: null,
        provider: null,
        parent_step_id: null,
        duration_ns: 0,
        input_data: null,
        output_data: null,
        metadata: null,
        raw: null,
        children: roots,
        response_id: null,
      },
    ],
  };
};

const SpanName = ({ spanTreeNode }: { spanTreeNode: SpanTreeNode }) => {
  if (spanTreeNode.name) {
    return <p className="font-semibold">{spanTreeNode.name}</p>;
  }
  if (spanTreeNode.model) {
    return <p className="font-semibold">{spanTreeNode.model}</p>;
  }
  return <p className="font-semibold">{spanTreeNode.id}</p>;
};

const SpanType = ({ spanTreeNode }: { spanTreeNode: SpanTreeNode }) => {
  if (spanTreeNode.input_messages || spanTreeNode.output_messages || spanTreeNode.model) {
    return <Icon {...spanColors[InteractionStepType.enum.LLM_CALL]} className="w-6 h-6 min-w-6 min-h-6" />;
  }

  if (spanTreeNode.name) {
    return <Icon {...spanColors[InteractionStepType.enum.TOOL_CALL]} className="w-6 h-6 min-w-6 min-h-6" />;
  }

  return <Icon {...spanColors[InteractionStepType.enum.ROOT]} className="w-6 h-6 min-w-6 min-h-6" />;
};

const SpanContainer = ({
  spanTreeNode,
  parent,
  lastChildRef,
  indent = 0,
}: {
  spanTreeNode: SpanTreeNode;
  parent?: InteractionStep;
  indent?: number;
  lastChildRef?: React.RefObject<HTMLDivElement | null>;
}) => {
  const params: RouteData = useParams();
  const { interactionStepId, testCaseId } = params;
  const { nodeMap, testCase, judgeInputIndex } = useTraceSidebar();
  const navigate = useNavigate();
  const selectedStep = nodeMap.get(interactionStepId ?? "");

  const [isOpen, setIsOpen] = useState(true);
  const [height, setHeight] = useState(0);

  const parentRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);

  let spanOffset = 8 + indent * 14;

  const calculateHeight = () => {
    const parent = parentRef.current;
    const children = childRef.current;

    if (!parent || !children) return;
    const parentRect = parent.getBoundingClientRect();
    const childrenRect = children.getBoundingClientRect();

    const childMiddleHeight = childrenRect.bottom - (childrenRect.bottom - childrenRect.top) / 2;

    setHeight(childMiddleHeight - parentRect.top);
  };

  useEffect(() => {
    calculateHeight();
    const element = childrenRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateHeight();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full space-y-0.5 overflow-x-hidden">
      <div
        style={{ paddingLeft: `${spanOffset}px` }}
        className={cn(
          "h-10 relative flex-nowrap text-nowrap w-full justify-between flex items-center text-xs rounded-md hover:bg-neutral-50 transition hover:cursor-pointer group peer",
          selectedStep?.id === spanTreeNode.id && "bg-neutral-50"
        )}
        onClick={() => {
          if (testCase.test_case_type === TestCaseType.enum.ranking) {
            navigate(
              routes
                .view_test_case(testCaseId!)
                .view_test_case_pairwise_trace(judgeInputIndex?.toString() ?? "0")
                .view_test_case_pairwise_trace_interaction_step(spanTreeNode.id.toString())
                .VIEW_TEST_CASE_PAIRWISE_TRACE_INTERACTION_STEP
            );
          } else {
            navigate(
              routes.view_test_case(testCaseId!).view_test_case_trace_interaction_step(spanTreeNode.id.toString())
                .VIEW_TEST_CASE_TRACE_INTERACTION_STEP
            );
          }
        }}
      >
        {isOpen && spanTreeNode.children.length > 0 && <VerticalConnector lineHeight={height} left={5} />}
        {parent && <HorizontalConnector height={22} width={18} left={-9} />}
        <div ref={lastChildRef} className="z-100">
          <div ref={parentRef} className="flex items-center gap-2 overflow-hidden relative">
            <SpanType spanTreeNode={spanTreeNode} />
            <div className="flex flex-col">
              <SpanName spanTreeNode={spanTreeNode} />
              <div className="flex">
                <p className="text-muted-foreground font-normal text-nowrap">
                  {round(spanTreeNode.duration_ns ?? 0, 2)}ns
                </p>
                {spanTreeNode.usage ? (
                  <p className="text-xs text-muted-foreground font-normal text-nowrap">
                    , {spanTreeNode.usage.input_tokens} input tok, {spanTreeNode.usage.output_tokens} output tok
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "absolute z-200 right-0 h-10 flex items-center px-3 bg-white group-hover:bg-neutral-50 transition rounded-md",
            selectedStep?.id === spanTreeNode.id && "bg-neutral-50"
          )}
        >
          <Label className="h-full flex items-center ">
            {spanTreeNode.children.length > 0 ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
                size="icon"
                className="rounded-sm w-4 h-4 min-w-4 min-h-4 shadow-none"
                variant="ghost"
              >
                <ChevronRight
                  data-state={isOpen ? "open" : "closed"}
                  className="ml-auto transition-transform data-[state=open]:rotate-90 text-stone-500"
                />
              </Button>
            ) : (
              <div className="w-4 h-4" />
            )}
          </Label>
        </div>
      </div>
      <div ref={childrenRef}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            {spanTreeNode.children.map((e, i) => {
              return (
                <SpanContainer
                  key={e.id}
                  spanTreeNode={e}
                  indent={indent + 1}
                  parent={spanTreeNode}
                  lastChildRef={i === spanTreeNode.children.length - 1 ? childRef : undefined}
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

interface TraceSidebarContextValue {
  nodeMap: Map<string, SpanTreeNode>;
  testCase: AnnotationTestCase;
  judgeInputIndex?: number;
}

const TraceSidebarContext = createContext<TraceSidebarContextValue | null>(null);

const TraceSidebarProvider = ({
  children,
  testCase,
  judgeInputIndex,
  nodeMap,
}: {
  nodeMap: Map<string, SpanTreeNode>;
  testCase: AnnotationTestCase;
  children: React.ReactNode;
  judgeInputIndex?: number;
}) => {
  const value = useMemo(() => ({ nodeMap, testCase, judgeInputIndex }), [nodeMap, testCase, judgeInputIndex]);
  return <TraceSidebarContext.Provider value={value}>{children}</TraceSidebarContext.Provider>;
};

const useTraceSidebar = () => {
  const context = useContext(TraceSidebarContext);
  if (!context) {
    throw new Error("useTraceSidebar must be used within a TraceSidebarProvider");
  }
  return context;
};

const StepMetricItem = ({ label, value }: { label: string; value?: string | null }) => {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", value ? "text-foreground" : "text-muted-foreground")}>{value ?? "N/A"}</p>
    </div>
  );
};

const StepMetrics = ({ step }: { step: InteractionStep }) => {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <StepMetricItem label="Duration" value={round(step.duration_ns ?? 0, 2)} />
      <StepMetricItem label="Provider" value={step.provider} />
      <StepMetricItem label="Model" value={step.model} />
      <StepMetricItem label="Input Tokens" value={step.usage?.input_tokens?.toString()} />
      <StepMetricItem label="Output Tokens" value={step.usage?.output_tokens?.toString()} />
    </div>
  );
};

export const CodeViewer = ({ value }: { value: string | null }) => {
  let _value = value ?? "No data found";
  return (
    <CodeMirror
      className="border rounded-md text-xs overflow-auto"
      value={_value}
      editable={false}
      theme={githubLight}
      extensions={[json(), EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: false,
        highlightActiveLineGutter: false,
        highlightActiveLine: false,
        foldGutter: false,
      }}
    />
  );
};

const CustomTabTrigger = ({ children, value }: { children: React.ReactNode; value: string }) => {
  return (
    <TabsTrigger
      className="hover:cursor-pointer hover:bg-stone-100 data-[state=active]:hover:bg-stone-100 shadow-none rounded-none border-b border-transparent data-[state=active]:border-b data-[state=active]:border-black data-[state=active]:shadow-none"
      value={value}
    >
      {children}
    </TabsTrigger>
  );
};

const StepDetail = ({ selectedStep }: { selectedStep: SpanTreeNode }) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="p-4 pb-2 space-y-1 flex-shrink-0">
        <p className="text-sm text-muted-foreground font-mono">{selectedStep.id}</p>
        <div className="flex items-center gap-2 text-lg">
          <SpanType spanTreeNode={selectedStep as SpanTreeNode} />
          <SpanName spanTreeNode={selectedStep as SpanTreeNode} />
        </div>
      </div>
      <Tabs className="w-full flex-1 min-h-0 flex flex-col overflow-hidden" defaultValue="detail">
        <TabsList className="bg-transparent shadow-none p-0 rounded-none h-fit w-full justify-start border-b border-b-stone-200 px-4 flex-shrink-0">
          <CustomTabTrigger value="detail">Details</CustomTabTrigger>
          <CustomTabTrigger value="raw">Raw Data</CustomTabTrigger>
        </TabsList>
        <TabsContent value="detail" className="pt-2 px-4 flex-1 min-h-0 overflow-auto space-y-4">
          <CollapsibleDetailField title="Metrics">
            <StepMetrics step={selectedStep} />
          </CollapsibleDetailField>
          <CollapsibleDetailField title="Input Data">
            <CodeViewer value={stringifyDataType(selectedStep.input_data)} />
          </CollapsibleDetailField>
          <CollapsibleDetailField title="Output Data">
            <CodeViewer value={stringifyDataType(selectedStep.output_data)} />
          </CollapsibleDetailField>
          <CollapsibleDetailField title="Metadata">
            <CodeViewer value={stringifyDataType(selectedStep.metadata)} />
          </CollapsibleDetailField>
          <div className="min-h-14" />
        </TabsContent>
        <TabsContent value="raw" className="pt-2 px-4 flex-1 min-h-0 overflow-auto space-y-4">
          <CodeViewer value={stringifyDataType(selectedStep.raw)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TraceSidebarContent = ({ rootSpanTreeNode }: { rootSpanTreeNode: SpanTreeNode }) => {
  const params: RouteData = useParams();
  const { interactionStepId } = params;
  const { nodeMap } = useTraceSidebar();

  const selectedStep = nodeMap.get(interactionStepId ?? "");

  if (!selectedStep) {
    return (
      <div className="h-full w-full min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto p-2">
          <SpanContainer spanTreeNode={rootSpanTreeNode} />
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full min-h-0 overflow-hidden">
      <ResizablePanel defaultSize={30} minSize={20} className="min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto p-2">
          <SpanContainer spanTreeNode={rootSpanTreeNode} />
          <div className="min-h-14" />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70} minSize={50} className="min-h-0 overflow-hidden">
        <StepDetail selectedStep={selectedStep} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

const TraceSidebarComponent = ({
  interactionTrace,
  testCase,
}: {
  interactionTrace: InteractionStep | Interaction | InteractionGroup;
  testCase: AnnotationTestCase;
}) => {
  const isSingleStepTrace = isSingleStep(interactionTrace);
  const stepId = isSingleStepTrace ? (interactionTrace as InteractionStep).id : null;
  const granularity = testCase.feedback_config.granularity;

  const shouldFetchInteraction = isSingleStepTrace && !!stepId && granularity === "step";

  const { data: fullInteraction, isPending, error } = useGetInteractionForStep({
    stepId: stepId!,
    options: { enabled: shouldFetchInteraction },
  });


  const traceToUse = isSingleStepTrace && fullInteraction ? fullInteraction : interactionTrace;

  const { tree, nodeMap } = useMemo(() => parseInteractionTrace(traceToUse), [traceToUse]);
  const rootSpan = tree[0];


  if (shouldFetchInteraction && isPending) {
    return (
      <div className="flex h-full flex-col gap-2 p-4 overflow-auto">
        <Skeleton className="w-full h-8" />
        <Skeleton className="w-full h-8" />
        <Skeleton className="w-full h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-4 text-sm text-muted-foreground overflow-auto">
        Error loading interaction: {error.message}
      </div>
    );
  }

  if (!rootSpan) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-4 text-sm text-muted-foreground overflow-auto">
        No spans available.
      </div>
    );
  }

  return (
    <TraceSidebarProvider nodeMap={nodeMap} testCase={testCase}>
      <TraceSidebarContent rootSpanTreeNode={rootSpan} />
    </TraceSidebarProvider>
  );
};

export const TraceSidebar = React.memo(TraceSidebarComponent);
TraceSidebar.displayName = "TraceSidebar";

const PairwiseTraceSidebarComponent = ({
  interactionTraces,
  testCase,
}: {
  interactionTraces: (InteractionStep | Interaction | InteractionGroup)[];
  testCase: AnnotationTestCase;
}) => {
  const params: RouteData = useParams();
  const navigate = useNavigate();
  const { testCaseId, judgeInputIndex } = params;
  const _judgeInputIndex = judgeInputIndex ? parseInt(judgeInputIndex) : 0;
  const interactionTrace = interactionTraces[_judgeInputIndex];

  const isSingleStepTrace = isSingleStep(interactionTrace);
  const stepId = isSingleStepTrace ? (interactionTrace as InteractionStep).id : null;

  const { data: fullInteraction, isPending, error } = useGetInteractionForStep({
    stepId: stepId!,
    options: { enabled: isSingleStepTrace && !!stepId },
  });

  const traceToUse = isSingleStepTrace && fullInteraction ? fullInteraction : interactionTrace;

  const { tree, nodeMap } = useMemo(() => parseInteractionTrace(traceToUse), [traceToUse]);
  const rootSpan = tree[0];

  if (isPending) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="p-2 flex-shrink-0">
          <Select
            value={_judgeInputIndex.toString()}
            onValueChange={(value) => {
              navigate(
                routes.view_test_case(testCaseId!).view_test_case_pairwise_trace(value).VIEW_TEST_CASE_PAIRWISE_TRACE
              );
            }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Select a test case" />
            </SelectTrigger>
            <SelectContent className="z-10000">
              {interactionTraces.map((interactionTrace, index) => (
                <SelectItem key={interactionTrace.id} value={index.toString()}>
                  Judge Input {index}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 p-4 overflow-auto flex-1">
          <Skeleton className="w-full h-8" />
          <Skeleton className="w-full h-8" />
          <Skeleton className="w-full h-8" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="p-2 flex-shrink-0">
          <Select
            value={_judgeInputIndex.toString()}
            onValueChange={(value) => {
              navigate(
                routes.view_test_case(testCaseId!).view_test_case_pairwise_trace(value).VIEW_TEST_CASE_PAIRWISE_TRACE
              );
            }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Select a test case" />
            </SelectTrigger>
            <SelectContent className="z-10000">
              {interactionTraces.map((interactionTrace, index) => (
                <SelectItem key={interactionTrace.id} value={index.toString()}>
                  Judge Input {index}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex flex-col justify-center gap-2 p-4 text-sm text-muted-foreground overflow-auto flex-1">
          Error loading interaction: {error.message}
        </div>
      </div>
    );
  }

  if (!rootSpan) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="p-2 flex-shrink-0">
          <Select
            value={_judgeInputIndex.toString()}
            onValueChange={(value) => {
              navigate(
                routes.view_test_case(testCaseId!).view_test_case_pairwise_trace(value).VIEW_TEST_CASE_PAIRWISE_TRACE
              );
            }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Select a test case" />
            </SelectTrigger>
            <SelectContent className="z-10000">
              {interactionTraces.map((interactionTrace, index) => (
                <SelectItem key={interactionTrace.id} value={index.toString()}>
                  Judge Input {index}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex flex-col justify-center gap-2 p-4 text-sm text-muted-foreground overflow-auto flex-1">
          No spans available.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-2 flex-shrink-0">
        <Select
          value={_judgeInputIndex.toString()}
          onValueChange={(value) => {
            navigate(
              routes.view_test_case(testCaseId!).view_test_case_pairwise_trace(value).VIEW_TEST_CASE_PAIRWISE_TRACE
            );
          }}
        >
          <SelectTrigger className="w-fit">
            <SelectValue placeholder="Select a test case" />
          </SelectTrigger>
          <SelectContent className="z-10000">
            {interactionTraces.map((interactionTrace, index) => (
              <SelectItem key={interactionTrace.id} value={index.toString()}>
                Judge Input {index}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="flex-1 min-h-0 overflow-hidden">
        <TraceSidebarProvider nodeMap={nodeMap} testCase={testCase} judgeInputIndex={_judgeInputIndex}>
          <TraceSidebarContent rootSpanTreeNode={rootSpan} />
        </TraceSidebarProvider>
      </div>
    </div>
  );
};

export const PairwiseTraceSidebar = React.memo(PairwiseTraceSidebarComponent);
PairwiseTraceSidebar.displayName = "PairwiseTraceSidebar";
