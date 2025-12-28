import { useClipboard } from "../lib/hooks";
import type { ScanSnapshot } from "../lib/api";

interface RestartPanelProps {
  restart: NonNullable<ScanSnapshot["restart"]>;
}

export function RestartPanel({ restart }: RestartPanelProps) {
  const { copied, copy } = useClipboard();

  return (
    <div className="restart-panel">
      <div className="restart-panel__header">
        <h3>Restart Session</h3>
      </div>

      <div className="restart-panel__section">
        <label className="restart-panel__label">Terminal Command:</label>
        <div className="restart-panel__row">
          <code className="restart-panel__code">{restart.cdCommand}</code>
          <button
            onClick={() => copy(restart.cdCommand, "cd")}
            className="restart-panel__copy-btn"
          >
            {copied === "cd" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="restart-panel__section">
        <label className="restart-panel__label">Restart Prompt:</label>
        <div className="restart-panel__prompt-container">
          <pre className="restart-panel__prompt">{restart.restartPromptMd}</pre>
        </div>
        <button
          onClick={() => copy(restart.restartPromptMd, "prompt")}
          className="restart-panel__copy-btn restart-panel__copy-btn--full"
        >
          {copied === "prompt" ? "Copied!" : "Copy Restart Prompt"}
        </button>
      </div>

      <style>{`
        .restart-panel {
          background: #e8f4fc;
          border: 1px solid #b8d4e8;
          border-radius: 8px;
          padding: 16px;
        }
        .restart-panel__header {
          margin-bottom: 16px;
        }
        .restart-panel__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #0066cc;
        }
        .restart-panel__section {
          margin-bottom: 16px;
        }
        .restart-panel__section:last-child {
          margin-bottom: 0;
        }
        .restart-panel__label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #555;
          margin-bottom: 6px;
        }
        .restart-panel__row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .restart-panel__code {
          flex: 1;
          padding: 8px 12px;
          background: white;
          border-radius: 4px;
          font-size: 13px;
          overflow-x: auto;
        }
        .restart-panel__prompt-container {
          max-height: 200px;
          overflow: auto;
          margin-bottom: 8px;
        }
        .restart-panel__prompt {
          padding: 12px;
          background: white;
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
        }
        .restart-panel__copy-btn {
          padding: 6px 12px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .restart-panel__copy-btn:hover {
          background: #f5f5f5;
        }
        .restart-panel__copy-btn--full {
          width: 100%;
          padding: 10px;
          background: #0066cc;
          color: white;
          border: none;
        }
        .restart-panel__copy-btn--full:hover {
          background: #0052a3;
        }
      `}</style>
    </div>
  );
}
