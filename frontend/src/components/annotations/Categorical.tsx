import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import React from "react";

export interface CategoricalOption {
  category: string;
}

interface CategoricalProps {
  categories: string[];
  onValueChange: (value: string) => void;
  value: string;
  readOnly?: boolean;
}

const Categorical = ({ categories, onValueChange, value, readOnly = false }: CategoricalProps) => {
  return (
    <RadioGroup value={value} className="gap-1" onValueChange={(e) => onValueChange(e)} disabled={readOnly}>
      {categories.map((c) => (
        <div
          key={c}
          className={cn(
            "flex items-center hover:bg-muted hover:cursor-pointer px-2 gap-2 rounded-md",
            c === value ? "hover:bg-blue-50 bg-blue-50" : "",
            readOnly && "pointer-events-none"
          )}
        >
          <RadioGroupItem value={c} id={c} />
          <Label
            onClick={() => !readOnly && onValueChange(c)}
            className={cn("w-full h-8 flex flex-1 items-center", c === value ? "text-blue-800" : "")}
            htmlFor={c}
          >
            {c}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
};

export default Categorical;
