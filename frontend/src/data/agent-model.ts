import { spanTypeToOklch } from "@/components/icons";
import { InteractionStepType, type LLMInteractionStep } from "@/types/interactions";
import type { NodeType as GraphNodeType, NodeData, SpanNode } from "@/types/nodes";
import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

export const traceSpans: LLMInteractionStep[] = [
  {
    span_id: "root",
    trace_id: "root",
    start_time: new Date(0),
    duration_ms: 565,
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "root",
    status: "success",
    name: "root",
    span_type: InteractionStepType.enum.ROOT,
    parent_span_id: null,
    end_time: null,
    model: null,
    input_messages: null,
    output_messages: null,
    usage: null,
    provider: null,
  },
  {
    span_id: "span-ingest-1",
    trace_id: "root",
    parent_span_id: "root",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Gather user prompt" }],
    output_messages: [{ role: "assistant", content: "Gather user prompt" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-ingest-1",
    name: "ingest",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-analysis-2",
    trace_id: "root",
    parent_span_id: "span-ingest-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Analyze user prompt" }],
    output_messages: [{ role: "assistant", content: "Analyze user prompt" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-analysis-2",
    name: "analysis",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-analysis-1",
    trace_id: "root",
    parent_span_id: "span-ingest-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Analyze user prompt" }],
    output_messages: [{ role: "assistant", content: "Analyze user prompt" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    name: "analysis",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
    response_id: null,
  },
  {
    span_id: "span-analysis-1",
    trace_id: "root",
    parent_span_id: "span-ingest-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Analyze user prompt" }],
    output_messages: [{ role: "assistant", content: "Analyze user prompt" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {
      tokens: 540,
    },
    raw: {},
    response_id: "span-analysis-1",
    name: "analysis",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-analysis-3",
    trace_id: "root",
    parent_span_id: "root",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Analyze user prompt" }],
    output_messages: [{ role: "assistant", content: "Analyze user prompt" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-analysis-3",
    name: "analysis",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-planner-1",
    trace_id: "root",
    parent_span_id: "root",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Plan iteration 1" }],
    output_messages: [{ role: "assistant", content: "Plan iteration 1" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-planner-1",
    name: "planner",
    span_type: InteractionStepType.enum.TOOL_CALL,
    end_time: null,
  },
  {
    span_id: "span-executor-1",
    trace_id: "root",
    parent_span_id: "span-planner-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Run retrieval tool" }],
    output_messages: [{ role: "assistant", content: "Run retrieval tool" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-executor-1",
    name: "executor",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-planner-2",
    trace_id: "root",
    parent_span_id: "span-executor-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Plan iteration 2" }],
    output_messages: [{ role: "assistant", content: "Plan iteration 2" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-planner-2",
    name: "planner",
    span_type: InteractionStepType.enum.TOOL_CALL,
    end_time: null,
  },
  {
    span_id: "span-executor-2",
    trace_id: "root",
    parent_span_id: "span-planner-2",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Invoke calculator" }],
    output_messages: [{ role: "assistant", content: "Invoke calculator" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-executor-2",
    name: "executor",
    span_type: InteractionStepType.enum.LLM_CALL,
    end_time: null,
  },
  {
    span_id: "span-review-1",
    trace_id: "root",
    parent_span_id: "span-executor-2",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Validate aggregated evidence" }],
    output_messages: [{ role: "assistant", content: "Validate aggregated evidence" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "success",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-review-1",
    name: "review",
    span_type: InteractionStepType.enum.FUNCTION_CALL,
    end_time: null,
  },
  {
    span_id: "span-finalize-1",
    trace_id: "root",
    parent_span_id: "span-review-1",
    model: "gpt-4o",
    input_messages: [{ role: "user", content: "Compose final response" }],
    output_messages: [{ role: "assistant", content: "Compose final response" }],
    usage: { input_tokens: 220, output_tokens: 220, total_tokens: 440 },
    provider: "openai",
    start_time: new Date(0),
    duration_ms: 35,
    status: "queued",
    input_payload: {},
    output_payload: {},
    metadata: {},
    raw: {},
    response_id: "span-finalize-1",
    name: "finalize",
    span_type: InteractionStepType.enum.TOOL_CALL,
    end_time: null,
  },
];

export type SpanGraph = {
  nodes: Node<NodeData>[];
  edges: Edge[];
};

const NODE_COLUMN_SPACING = 280;
const NODE_ROW_SPACING = 180;

const typeColumns: Record<GraphNodeType, number> = {
  ROOT: 0,
  LLM_CALL: 1,
  TOOL_CALL: 2,
  FUNCTION_CALL: 3,
};

export const buildSpanGraph = (spans: LLMInteractionStep[]): SpanGraph => {
  const spansByName = new Map<string, LLMInteractionStep[]>();
  const spansById = new Map<string, LLMInteractionStep>();

  spans.forEach((span) => {
    spansById.set(span.span_id, span);
    if (!spansByName.has(span.name)) {
      spansByName.set(span.name, []);
    }
    spansByName.get(span.name)!.push(span);
  });

  if (spansByName.size === 0) {
    return { nodes: [], edges: [] };
  }

  const groupedEntries = Array.from(spansByName.entries()).sort(([nameA, spansA], [nameB, spansB]) => {
    const typeA = (spansA[0]?.span_type ?? InteractionStepType.enum.LLM_CALL) as GraphNodeType;
    const typeB = (spansB[0]?.span_type ?? InteractionStepType.enum.LLM_CALL) as GraphNodeType;
    const columnDiff = typeColumns[typeA] - typeColumns[typeB];
    if (columnDiff !== 0) {
      return columnDiff;
    }

    const startA =
      spansA.reduce<number | undefined>((acc, span) => {
        const start = span.start_time?.getTime();
        if (start == null) return acc;
        return acc == null ? start : Math.min(acc, start);
      }, undefined) ?? 0;
    const startB =
      spansB.reduce<number | undefined>((acc, span) => {
        const start = span.start_time?.getTime();
        if (start == null) return acc;
        return acc == null ? start : Math.min(acc, start);
      }, undefined) ?? 0;

    if (startA !== startB) {
      return startA - startB;
    }

    return nameA.localeCompare(nameB);
  });

  const rowsByType = new Map<GraphNodeType, number>();

  const nodes = groupedEntries.map<SpanNode>(([name, groupedSpans]) => {
    const primarySpan = groupedSpans[0];
    const nodeType = (primarySpan?.span_type ?? InteractionStepType.enum.LLM_CALL) as GraphNodeType;
    const column = typeColumns[nodeType] ?? typeColumns[InteractionStepType.enum.LLM_CALL as GraphNodeType];
    const currentRow = rowsByType.get(nodeType) ?? 0;
    rowsByType.set(nodeType, currentRow + 1);

    return {
      id: name,
      type: nodeType,
      position: {
        x: column * NODE_COLUMN_SPACING,
        y: currentRow * NODE_ROW_SPACING,
      },
      data: {
        name,
        interactions: groupedSpans,
        type: nodeType,
      },
    };
  });

  const edgeMap = new Map<string, Edge>();
  const edgeCount = new Map<string, number>();
  spans.forEach((span) => {
    if (!span.parent_span_id) {
      return;
    }
    const parent = spansById.get(span.parent_span_id);
    if (!parent) {
      return;
    }
    if (!spansByName.has(parent.name) || !spansByName.has(span.name)) {
      return;
    }

    const edgeId = `${parent.name}->${span.name}`;
    edgeCount.set(edgeId, (edgeCount.get(edgeId) ?? 0) + 1);

    if (edgeMap.has(edgeId)) {
      return;
    }
    edgeMap.set(edgeId, {
      id: `${crypto.randomUUID()}-${edgeId}`,
      source: parent.name,
      target: span.name,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: spanTypeToOklch(parent.span_type),
      },
      style: {
        stroke: spanTypeToOklch(parent.span_type),
        strokeWidth: 1,
      },
    });
  });

  edgeCount.forEach((count, edgeId) => {
    if (count > 1) {
      edgeMap.get(edgeId)!.label = `${count.toString()} invocations`;
    }
  });

  const edges = Array.from(edgeMap.values());
  return { nodes, edges };
};
