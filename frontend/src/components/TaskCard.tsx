import { type TreeSpecNode, type TaskStatus } from "../lib/api";

interface TaskCardProps {
  task: TreeSpecNode;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onRemove: (taskId: string) => void;
  onStart: (taskId: string) => void;
  onClick?: (task: TreeSpecNode) => void;
  onConsult?: (task: TreeSpecNode) => void;
  loading: boolean;
  compact?: boolean;
  isLocked?: boolean;
  showClaudeButton?: boolean;
}

export function TaskCard({
  task,
  onStatusChange,
  onRemove,
  onStart,
  onClick,
  onConsult,
  loading,
  compact,
  isLocked,
  showClaudeButton,
}: TaskCardProps) {
  const hasWorktree = !!task.worktreePath;

  return (
    <div
      className={`task-card task-card--${task.status} ${compact ? "task-card--compact" : ""} ${hasWorktree ? "task-card--clickable" : ""}`}
      onClick={() => hasWorktree && onClick?.(task)}
    >
      <div className="task-card__header">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="task-card__status"
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
        >
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
        <span className="task-card__title">{task.title}</span>
        <div className="task-card__actions">
          {showClaudeButton && (
            <button
              className="task-card__claude"
              onClick={(e) => {
                e.stopPropagation();
                onConsult?.(task);
              }}
              title="Claudeでこのタスクについて相談"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Claude
            </button>
          )}
          {showClaudeButton && hasWorktree && (
            <button
              className="task-card__open"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(task);
              }}
              title="ターミナルを開く"
            >
              Terminal
            </button>
          )}
          {!isLocked && !task.branchName && task.status === "todo" && (
            <button
              className="task-card__start"
              onClick={(e) => {
                e.stopPropagation();
                onStart(task.id);
              }}
              disabled={loading}
            >
              Start
            </button>
          )}
          {!isLocked && (
            <button
              className="task-card__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(task.id);
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!compact && task.description && (
        <div className="task-card__description">{task.description}</div>
      )}
      <div className="task-card__meta">
        {task.branchName && (
          <span className="task-card__branch">{task.branchName}</span>
        )}
        {task.worktreePath && (
          <span className="task-card__worktree">WT</span>
        )}
      </div>
    </div>
  );
}
