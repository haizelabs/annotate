import { cn } from "@/lib/utils";
import { InteractionStepType } from "@/types/interactions";
import { NodeData, NodeType } from "@/types/nodes";
import { Handle, Position } from "@xyflow/react";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";
import { Icon, spanColors } from "./icons";

const nodeVariants = cva("group border p-4 transition-all hover:shadow-sm relative", {
  variants: {
    variant: {
      [NodeType.enum.LLM_CALL]:
        `${spanColors[InteractionStepType.enum.LLM_CALL].nodeBackgroundColor} ${spanColors[InteractionStepType.enum.LLM_CALL].borderColor}`,
      [NodeType.enum.FUNCTION_CALL]:
        `${spanColors[InteractionStepType.enum.FUNCTION_CALL].nodeBackgroundColor} ${spanColors[InteractionStepType.enum.FUNCTION_CALL].borderColor}`,
      [NodeType.enum.TOOL_CALL]:
        `${spanColors[InteractionStepType.enum.TOOL_CALL].nodeBackgroundColor} ${spanColors[InteractionStepType.enum.TOOL_CALL].borderColor}`,
      [NodeType.enum.ROOT]:
        `${spanColors[InteractionStepType.enum.ROOT].nodeBackgroundColor} ${spanColors[InteractionStepType.enum.ROOT].borderColor}`,
    },
  },
});

interface NodeContainerProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof nodeVariants> {}

const NodeContainer = React.forwardRef<HTMLDivElement, NodeContainerProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <div className={cn(nodeVariants({ variant, className }))} ref={ref} {...props}>
        {children}
      </div>
    );
  }
);

NodeContainer.displayName = "NodeContainer";

const cornerVariants = cva("absolute w-2 h-2 border rounded-[2px]", {
  variants: {
    variant: {
      [NodeType.enum.LLM_CALL]:
        `${spanColors[InteractionStepType.enum.LLM_CALL].borderColor} ${spanColors[InteractionStepType.enum.LLM_CALL].nodeBackgroundColor}`,
      [NodeType.enum.FUNCTION_CALL]:
        `${spanColors[InteractionStepType.enum.FUNCTION_CALL].borderColor} ${spanColors[InteractionStepType.enum.FUNCTION_CALL].nodeBackgroundColor}`,
      [NodeType.enum.TOOL_CALL]:
        `${spanColors[InteractionStepType.enum.TOOL_CALL].borderColor} ${spanColors[InteractionStepType.enum.TOOL_CALL].nodeBackgroundColor}`,
      [NodeType.enum.ROOT]:
        `${spanColors[InteractionStepType.enum.ROOT].borderColor} ${spanColors[InteractionStepType.enum.ROOT].nodeBackgroundColor}`,
    },
  },
});

const NodeCorners = ({ variant }: { variant: NodeType }) => {
  return (
    <>
      <span className={cn(cornerVariants({ variant }), "-top-1 -left-1")}></span>
      <span className={cn(cornerVariants({ variant }), "-top-1 -right-1")}></span>
      <span className={cn(cornerVariants({ variant }), "-bottom-1 -left-1")}></span>
      <span className={cn(cornerVariants({ variant }), "-bottom-1 -right-1")}></span>
    </>
  );
};

export function AgentNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <NodeContainer variant={data.type} className={cn("shadow-sm w-[200px]")}>
      <Handle
        type="target"
        position={Position.Top}
        className="h-2 w-2 rounded-full border border-background bg-border dark:bg-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <Icon {...spanColors[data.type]} className="w-6 h-6 min-w-6 min-h-6" />

        <p className="text-sm font-semibold leading-none text-foreground">{data.name}</p>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.interactions.length} spans</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="h-2 w-2 rounded-full border border-background bg-border dark:bg-muted-foreground"
      />
      <NodeCorners variant={data.type} />
    </NodeContainer>
  );
}
