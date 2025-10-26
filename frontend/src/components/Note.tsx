import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import React from "react";

const noteVariants = cva("rounded-sm p-3 flex justify-between items-center gap-4", {
  variants: {
    variant: {
      blank: "border",
      info: "bg-blue-100 text-blue-700",
      warning: "bg-amber-100 text-amber-700",
      error: "bg-red-100 text-red-700",
      violet: "bg-violet-100 text-violet-700",
      success: "bg-emerald-100 text-emerald-700",
    },
    size: {
      default: "text-normal",
      sm: "text-sm",
      lg: "text-lg",
    },
    defaultVariants: {
      variant: "info",
      size: "default",
    },
  },
});

export type NoteVariants = VariantProps<typeof noteVariants>["variant"];

export interface NoteProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof noteVariants> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const Note = ({ variant, size, icon, action, children, className, ...props }: NoteProps) => {
  let _icon = icon;

  if (!icon) {
    switch (variant) {
      case "info":
        _icon = <Info className="min-w-5 min-h-5 max-w-5 max-h-5" />;
        break;
      case "warning":
        _icon = <TriangleAlert className="min-w-5 min-h-5 max-w-5 max-h-5" />;
        break;
      case "error":
        _icon = <CircleAlert className="min-w-5 min-h-5 max-w-5 max-h-5" />;
        break;
      case "success":
        _icon = <CircleCheck className="min-w-5 min-h-5 max-w-5 max-h-5" />;
        break;
      default:
        _icon = <Info className="min-w-5 min-h-5 max-w-5 max-h-5" />;
        break;
    }
  }

  return (
    <div className={cn(noteVariants({ variant, size }), className)} {...props}>
      <div className="flex items-start gap-4">
        {_icon}
        {children}
      </div>
      {action}
    </div>
  );
};

interface ErrorNoteProps extends NoteProps {
  errorMessage: string;
  prefix?: string;
}

export const ErrorNote = ({ errorMessage, prefix, ...props }: ErrorNoteProps) => {
  return (
    <Note variant="error" {...props}>
      <p className="text-sm">
        {prefix} {errorMessage}
      </p>
    </Note>
  );
};
