import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";

export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: { grip: ReactNode }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
    opacity: isDragging ? 0.88 : 1,
    position: "relative",
  };
  const grip = (
    <button
      type="button"
      aria-label="גרירת פריט"
      className="flex h-7 w-6 shrink-0 flex-col items-center justify-center gap-[3px] rounded-md text-[#3d6b4a]"
      {...attributes}
      {...listeners}
    >
      <span className="block h-[2px] w-3.5 rounded-full bg-current" />
      <span className="block h-[2px] w-3.5 rounded-full bg-current" />
      <span className="block h-[2px] w-3.5 rounded-full bg-current" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children({ grip })}
    </div>
  );
}
