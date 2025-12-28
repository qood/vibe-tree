import type { Warning } from "../lib/api";

interface WarningListProps {
  warnings: Warning[];
}

export function WarningList({ warnings }: WarningListProps) {
  if (warnings.length === 0) {
    return (
      <div className="warning-list warning-list--empty">
        <span className="warning-list__icon">✓</span>
        <span>No warnings</span>
      </div>
    );
  }

  return (
    <div className="warning-list">
      <div className="warning-list__header">
        <h3>Warnings ({warnings.length})</h3>
      </div>
      <div className="warning-list__items">
        {warnings.map((w, i) => (
          <div
            key={i}
            className={`warning-list__item warning-list__item--${w.severity}`}
          >
            <span className="warning-list__severity">
              {w.severity === "error" ? "⛔" : "⚠️"}
            </span>
            <div className="warning-list__content">
              <span className="warning-list__code">{w.code}</span>
              <span className="warning-list__message">{w.message}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .warning-list {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
        }
        .warning-list--empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #28a745;
          font-weight: 500;
        }
        .warning-list__icon {
          font-size: 18px;
        }
        .warning-list__header {
          margin-bottom: 12px;
        }
        .warning-list__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        .warning-list__items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .warning-list__item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 6px;
        }
        .warning-list__item--warn {
          background: #fff8e6;
          border: 1px solid #ffe0a0;
        }
        .warning-list__item--error {
          background: #fee;
          border: 1px solid #fcc;
        }
        .warning-list__severity {
          font-size: 14px;
          flex-shrink: 0;
        }
        .warning-list__content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .warning-list__code {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
        }
        .warning-list__message {
          font-size: 13px;
          color: #333;
        }
      `}</style>
    </div>
  );
}
