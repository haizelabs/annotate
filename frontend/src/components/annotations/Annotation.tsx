import { cn } from "@/lib/utils";
import React from "react";

const AnnotationHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("font-semibold", className)} {...props} />
);
AnnotationHeader.displayName = "AnnotationHeader";

const Annotation = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded border bg-card text-card-foreground", className)} {...props} />
  )
);
Annotation.displayName = "Annotation";

const AnnotationContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 space-y-4", className)} {...props} />
);
AnnotationContent.displayName = "AnnotationContent";

export { Annotation, AnnotationContent, AnnotationHeader };
