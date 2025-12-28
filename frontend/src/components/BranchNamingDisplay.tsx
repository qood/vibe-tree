import { Link } from "react-router-dom";
import type { BranchNamingRule } from "../lib/api";

interface BranchNamingDisplayProps {
  rule: BranchNamingRule | null;
  repoId: number;
  showEditLink?: boolean;
}

export function BranchNamingDisplay({
  rule,
  repoId,
  showEditLink = true,
}: BranchNamingDisplayProps) {
  if (!rule) {
    return (
      <div className="branch-naming-display branch-naming-display--empty">
        <p>No branch naming rule configured</p>
        {showEditLink && (
          <Link to={`/settings?repoId=${repoId}`}>Configure in Settings</Link>
        )}
      </div>
    );
  }

  return (
    <div className="branch-naming-display">
      <div className="branch-naming-display__header">
        <h3>Branch Naming Rule</h3>
        {showEditLink && (
          <Link to={`/settings?repoId=${repoId}`} className="branch-naming-display__edit-link">
            Edit
          </Link>
        )}
      </div>
      <div className="branch-naming-display__content">
        <div className="branch-naming-display__row">
          <span className="branch-naming-display__label">Pattern:</span>
          <code className="branch-naming-display__pattern">{rule.pattern}</code>
        </div>
        {rule.description && (
          <div className="branch-naming-display__row">
            <span className="branch-naming-display__label">Description:</span>
            <span>{rule.description}</span>
          </div>
        )}
        <div className="branch-naming-display__row">
          <span className="branch-naming-display__label">Examples:</span>
          <div className="branch-naming-display__examples">
            {rule.examples.map((ex, i) => (
              <code key={i} className="branch-naming-display__example">
                {ex}
              </code>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .branch-naming-display {
          padding: 16px;
          background: #e8f4fc;
          border-radius: 8px;
          border: 1px solid #b8d4e8;
        }
        .branch-naming-display--empty {
          background: #f5f5f5;
          border-color: #ddd;
          text-align: center;
          color: #666;
        }
        .branch-naming-display__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .branch-naming-display__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
        .branch-naming-display__edit-link {
          font-size: 13px;
        }
        .branch-naming-display__content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .branch-naming-display__row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
        }
        .branch-naming-display__label {
          font-weight: 500;
          color: #555;
          min-width: 80px;
        }
        .branch-naming-display__pattern {
          font-size: 13px;
          padding: 2px 8px;
          background: white;
          border-radius: 3px;
        }
        .branch-naming-display__examples {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .branch-naming-display__example {
          font-size: 12px;
          padding: 2px 6px;
          background: white;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
