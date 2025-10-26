import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronRight } from "lucide-react";
import React, { useState } from "react";

interface CollapsibleDetailFieldProps extends React.PropsWithChildren {
  title: string;
  showSeparator?: boolean;
  open?: boolean;
}

export const CollapsibleDetailField = ({
  title,
  children,
  showSeparator = true,
  open = true,
}: CollapsibleDetailFieldProps) => {
  const [isOpen, setIsOpen] = useState(open);
  return (
    <div className="flex flex-col">
      {showSeparator && <Separator className="space-y-2" />}
      <Label className="mb-2 flex gap-2 w-full hover:bg-neutral-100 px-0 py-2 hover:px-2 transition-all rounded-b-md hover:cursor-pointer">
        {title}
        <Button
          className="w-4 h-4 hover:bg-none bg-none"
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronRight
            data-state={isOpen ? "open" : "closed"}
            className=" ml-auto transition-transform data-[state=open]:rotate-90"
          />
        </Button>
      </Label>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    </div>
  );
};
