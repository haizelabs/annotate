import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, GripVertical } from "lucide-react";
import React from "react";

export type ScenarioFlowProps = {
  height?: number | string;
};

export type Option = {
  id: string;
};

const Ranking = ({
  ordering,
  setOrdering,
  disabled = false,
}: {
  ordering: Option[];
  setOrdering: (ordering: Option[]) => void;
  disabled?: boolean;
}) => {
  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const oldIndex = ordering.findIndex((n) => n.id === String(active.id));
    const newIndex = ordering.findIndex((n) => n.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(ordering, oldIndex, newIndex);
    setOrdering(reordered);
  };

  return (
    <div className="flex flex-col gap-1">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={ordering.map((n) => n.id)}>
          <div className="flex-1 space-y-3">
            {ordering.map((n, idx) => (
              <SortableRow key={n.id} id={n.id} index={idx} text={n.id} disabled={disabled} totalItems={ordering.length} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

type SortableRowProps = {
  id: string;
  index: number;
  text: string;
  disabled?: boolean;
};

const SortableRow = ({ id, index, text, disabled = false, totalItems }: SortableRowProps & { totalItems?: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const renderLabel = () => {
    if (disabled && totalItems !== undefined) {
      if (index === 0) {
        return (
          <div className="flex gap-1 items-center">
            <p className="text-sm text-muted-foreground italic">(Best)</p>
            <ArrowDown className="w-3 h-3 text-muted-foreground" />
          </div>
        );
      }
      if (index === totalItems - 1) {
        return <p className="text-sm text-muted-foreground italic">(Worst)</p>;
      }
      return null;
    }
    return <p className="text-sm">{index + 1}.</p>;
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 rounded border w-full p-2 items-center bg-white">
      {renderLabel()}
      <p className="text-sm">{id}</p>
      {!disabled && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            title="Drag to reorder"
            className="cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Ranking;
