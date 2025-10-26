import { Node } from "@xyflow/react";
import * as z from "zod";
import { InteractionStep } from "./interactions";

export const NodeType = z.enum(["LLM_CALL", "FUNCTION_CALL", "TOOL_CALL", "ROOT"]);

export const NodeData = z.object({
  interactions: z.array(InteractionStep),
  name: z.string(),
  type: NodeType,
});

export const NodeBase = z.object({
  id: z.string(),
  data: NodeData,
});

export type NodeType = z.infer<typeof NodeType>;
export type NodeData = z.infer<typeof NodeData>;
export type NodeBase = z.infer<typeof NodeBase>;

export type SpanNode = Node<NodeData>;
