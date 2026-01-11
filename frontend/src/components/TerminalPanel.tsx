import { useEffect, useState } from "react";
import { api, TerminalSession } from "../lib/api";
import { Terminal } from "./Terminal";

interface TerminalPanelProps {
  repoId: string;
  worktreePath: string;
  onClose?: () => void;
  taskContext?: {
    title: string;
    description?: string;
  };
  autoRunClaude?: boolean;
}

export function TerminalPanel({
  repoId,
  worktreePath,
  onClose,
  taskContext,
  autoRunClaude,
}: TerminalPanelProps) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        setError(null);
        // Create or get existing session
        const sess = await api.createTerminalSession(repoId, worktreePath);
        setSession(sess);

        // Auto-start if not running
        if (sess.status === "stopped") {
          setStarting(true);
          await api.startTerminalSession(sess.id);
          setSession((prev) => (prev ? { ...prev, status: "running" } : null));
          setStarting(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize terminal");
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [repoId, worktreePath]);

  const handleRestart = async () => {
    if (!session) return;
    try {
      setStarting(true);
      setError(null);
      await api.startTerminalSession(session.id);
      setSession((prev) => (prev ? { ...prev, status: "running" } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restart terminal");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1b26] text-[#a9b1d6]">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Initializing terminal...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1a1b26] text-[#a9b1d6] gap-4">
        <div className="text-red-400">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-[#7aa2f7] text-white rounded hover:bg-[#5d7ec9]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1b26] text-[#a9b1d6]">
        No session available
      </div>
    );
  }

  if (session.status === "stopped" || starting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1a1b26] text-[#a9b1d6] gap-4">
        <div className="text-sm">{starting ? "Starting terminal..." : "Terminal stopped"}</div>
        {!starting && (
          <button
            onClick={handleRestart}
            className="px-3 py-1.5 bg-[#7aa2f7] text-white rounded hover:bg-[#5d7ec9]"
          >
            Start Terminal
          </button>
        )}
      </div>
    );
  }

  return (
    <Terminal
      sessionId={session.id}
      onClose={onClose}
      taskContext={taskContext}
      autoRunClaude={autoRunClaude}
    />
  );
}
