import { Slider } from "@/components/ui/slider";
import React from "react";

const Score = ({
  min,
  max,
  prefix = "Set annotation score:",
  value,
  setValue,
  disabled = false,
}: {
  min: number;
  max: number;
  prefix?: string;
  value: number;
  setValue: (value: number) => void;
  disabled?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        {prefix} {value}
      </p>
      <Slider
        min={min}
        max={max}
        step={1}
        defaultValue={[min]}
        value={[value]}
        onValueChange={(value) => setValue(value[0])}
        disabled={disabled}
      />
    </div>
  );
};

export default Score;
