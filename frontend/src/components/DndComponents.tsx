import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type TreeSpecNode } from "../lib/api";

interface DraggableTaskProps {
  task: TreeSpecNode;
  children: React.ReactNode;
}

export function DraggableTask({ task, children }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: "grab" }}
    >
      {children}
    </div>
  );
}

interface DroppableTreeNodeProps {
  id: string;
  children: React.ReactNode;
  isOver?: boolean;
}

export function DroppableTreeNode({ id, children, isOver }: DroppableTreeNodeProps) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`droppable-zone ${dropIsOver || isOver ? "droppable-zone--over" : ""}`}
    >
      {children}
    </div>
  );
}
