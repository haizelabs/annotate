import { cn } from "@/lib/utils";
import { InteractionStepType } from "@/types/interactions";
import { NodeType } from "@/types/nodes";
import { MessageCircle, Parentheses, PencilRuler, Wrench } from "lucide-react";
import React from "react";

export interface IconColor {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  icon: React.JSX.Element;
  spanColor: string;
  nodeBackgroundColor: string;
  textColor?: string;
}

export const spanColors: Record<InteractionStepType, IconColor> = {
  ROOT: {
    backgroundColor: "bg-neutral-600",
    spanColor: "bg-neutral-600",
    borderColor: "border-neutral-600",
    nodeBackgroundColor: "bg-neutral-50",
    iconColor: "text-white",
    icon: <Wrench />,
  },
  TOOL_CALL: {
    backgroundColor: "bg-cyan-600",
    spanColor: "bg-cyan-600",
    borderColor: "border-cyan-600",
    nodeBackgroundColor: "bg-cyan-50",
    iconColor: "text-white",
    icon: <PencilRuler />,
  },
  LLM_CALL: {
    backgroundColor: "bg-emerald-600",
    spanColor: "bg-emerald-600",
    borderColor: "border-emerald-600",
    nodeBackgroundColor: "bg-emerald-50",
    iconColor: "text-white",
    icon: <MessageCircle />,
  },

  FUNCTION_CALL: {
    backgroundColor: "bg-indigo-600",
    spanColor: "bg-indigo-600",
    borderColor: "border-indigo-600",
    nodeBackgroundColor: "bg-indigo-50",
    iconColor: "text-white",
    icon: <Parentheses />,
  },
} as const;

export const spanTypeToOklch = (spanType: InteractionStepType) => {
  switch (spanType) {
    case NodeType.enum.LLM_CALL:
      return "oklch(59.6% 0.145 163.225)";
    case NodeType.enum.FUNCTION_CALL:
      return "oklch(51.1% 0.262 276.966)";
    case NodeType.enum.TOOL_CALL:
      return "oklch(60.9% 0.126 221.723)";
    case NodeType.enum.ROOT:
      return "oklch(43.9% 0 0)";
    default:
      return "oklch(60.9% 0.126 221.723)";
  }
};

export const Icon = ({
  icon,
  className = "",
  iconStyles = "h-4 w-4",
  backgroundColor = "bg-neutral-50",
  borderColor = "border-neutral-500",
  iconColor = "text-neutral-500",
  textColor = "text-neutral-500",
}: {
  className?: string;
  iconStyles?: string;
  icon?: React.JSX.Element;
  backgroundColor?: string;
  borderColor?: string;
  iconColor?: string;
  textColor?: string;
}) => {
  const styledIcon = icon
    ? React.cloneElement(icon, {
        className: cn(iconColor, iconStyles),
      })
    : null;

  return (
    <div
      className={cn(
        "w-8 h-8 border min-w-8 min-h-8 rounded-sm flex justify-center items-center",
        backgroundColor,
        borderColor,
        textColor,
        className
      )}
    >
      {styledIcon}
    </div>
  );
};
