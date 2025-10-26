import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React, { ComponentPropsWithoutRef, PropsWithChildren } from "react";

const tagVariants = cva("w-fit px-2 py-0.5 gap-2 border items-center flex justify-center text-sm rounded-full", {
  variants: {
    variant: {
      red: "bg-rose-50 border-rose-500 text-rose-800",
      green: "bg-emerald-50 border-emerald-500 text-emerald-800",
      blue: "bg-sky-50 border-sky-500 text-sky-800",
      purple: "bg-purple-50 border-purple-500 text-purple-800",
      gray: "bg-gray-50 border-gray-500 text-gray-800",
      failed: "bg-amber-50 border-amber-500 text-amber-800",
      step: "bg-sky-100 border-sky-500 text-sky-800",
      interaction: "bg-purple-100 border-purple-500 text-purple-800",
      group: "bg-emerald-100 border-emerald-500 text-emerald-800",
    },
  },
});

export type TagVariants = VariantProps<typeof tagVariants>["variant"];

export interface TagProps extends PropsWithChildren, ComponentPropsWithoutRef<"div">, VariantProps<typeof tagVariants> {
  icon?: React.ReactNode;
  border?: boolean;
}

export const Tag = ({ variant, className, border = true, ...props }: TagProps) => {
  return (
    <div {...props} className={cn(tagVariants({ variant }), className, border ? "border" : "border-none")}>
      {props.icon}
      {props.children}
    </div>
  );
};
