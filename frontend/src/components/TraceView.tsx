import { AgentNode } from "@/components/agent-node";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { buildSpanGraph } from "@/data/agent-model";
import { NodeData, NodeType, SpanNode } from "@/types/nodes";
import { Interaction, LLMInteractionStep } from "@app/types/interactions";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeftIcon } from "lucide-react";
import React from "react";
import { spanTypeToOklch } from "./icons";
import { TraceSidebar } from "./trace-sidebar";
import { Button } from "./ui/button";

const nodeTypes = {
  [NodeType.enum.LLM_CALL]: AgentNode,
  [NodeType.enum.FUNCTION_CALL]: AgentNode,
  [NodeType.enum.TOOL_CALL]: AgentNode,
  [NodeType.enum.ROOT]: AgentNode,
};

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const getLayoutedElements = (nodes: SpanNode[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: "TB" });

  edges.forEach((edge: Edge) => dagreGraph.setEdge(edge.source, edge.target));
  nodes.forEach((node: SpanNode) =>
    dagreGraph.setNode(node.id, {
      width: node.measured?.width ?? 500,
      height: node.measured?.height ?? 100,
    })
  );

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node: SpanNode) => {
      const { x, y } = dagreGraph.node(node.id);

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

const TraceView = ({
  interaction,
  setSelectedInteraction,
}: {
  interaction: Interaction;
  setSelectedInteraction: (interaction: Interaction | undefined) => void;
}) => {
  const steps = interaction.steps as LLMInteractionStep[];
  const { nodes: initialNodes, edges: initialEdges } = buildSpanGraph(steps);
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);
  return (
    <ReactFlowProvider>
      <div className="overflow-hidden flex min-h-screen max-h-screen w-full flex-col bg-background">
        <header className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 items-center">
              <Button size="sm" className="gap-4" onClick={() => setSelectedInteraction(undefined)}>
                <ArrowLeftIcon className="w-4 h-4" />
                Back
              </Button>
              <p>{interaction.id}</p>
            </div>
            <div className="hidden gap-2 text-xs text-muted-foreground sm:flex">
              <span>
                Nodes: <span className="font-medium text-foreground">{nodes.length}</span>
              </span>
              <span>
                Spans: <span className="font-medium text-foreground">{steps.length}</span>
              </span>
            </div>
          </div>
        </header>
        <ResizablePanelGroup direction="horizontal" className="h-full w-full flex-1 min-h-0">
          <ResizablePanel defaultSize={65} minSize={45} className="min-h-0">
            <div className="flex h-full flex-col gap-2 p-4">
              <div className=" flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agent Graph</h2>
                <span className="text-xs text-muted-foreground">Highlight follows selected span.</span>
              </div>
              <div className="flex-1 overflow-hidden rounded-sm border bg-card">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  minZoom={0.35}
                  maxZoom={1.5}
                >
                  <Background gap={24} />
                  <MiniMap
                    pannable
                    zoomable
                    className="!bg-background/90 !text-muted-foreground"
                    maskColor="rgba(15, 23, 42, 0.08)"
                    nodeColor={(node) => {
                      const data = node.data as NodeData;
                      return spanTypeToOklch(data.type);
                    }}
                  />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={25} className="min-h-0">
            <TraceSidebar steps={steps} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ReactFlowProvider>
  );
};

export default TraceView;
