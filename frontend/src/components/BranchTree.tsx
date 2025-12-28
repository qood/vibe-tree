import type { TreeNode, TreeEdge } from "../lib/api";

interface BranchTreeProps {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  dirty: { bg: "#ff9800", text: "white" },
  pr: { bg: "#2196F3", text: "white" },
  "pr-merged": { bg: "#9c27b0", text: "white" },
  "ci-fail": { bg: "#f44336", text: "white" },
};

export function BranchTree({ nodes, edges }: BranchTreeProps) {
  // Sort nodes: main/master first, then by last commit
  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.branchName === "main" || a.branchName === "master") return -1;
    if (b.branchName === "main" || b.branchName === "master") return 1;
    return new Date(b.lastCommitAt).getTime() - new Date(a.lastCommitAt).getTime();
  });

  return (
    <div className="branch-tree">
      <div className="branch-tree__header">
        <h3>Branch Tree</h3>
        <span className="branch-tree__count">{nodes.length} branches</span>
      </div>
      <div className="branch-tree__list">
        {sortedNodes.map((node) => {
          const edge = edges.find((e) => e.child === node.branchName);
          const isMainBranch = node.branchName === "main" || node.branchName === "master";

          return (
            <div
              key={node.branchName}
              className={`branch-tree__node ${node.worktree ? "branch-tree__node--active" : ""} ${isMainBranch ? "branch-tree__node--main" : ""}`}
            >
              <div className="branch-tree__node-header">
                {!isMainBranch && edge && (
                  <span className="branch-tree__indent">└─</span>
                )}
                <span className="branch-tree__name">{node.branchName}</span>
                <div className="branch-tree__badges">
                  {node.badges.map((badge) => (
                    <span
                      key={badge}
                      className="branch-tree__badge"
                      style={{
                        background: BADGE_COLORS[badge]?.bg ?? "#9e9e9e",
                        color: BADGE_COLORS[badge]?.text ?? "white",
                      }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {node.aheadBehind && (
                <div className="branch-tree__stats">
                  <span className="branch-tree__stat branch-tree__stat--ahead">
                    ↑ {node.aheadBehind.ahead}
                  </span>
                  <span className="branch-tree__stat branch-tree__stat--behind">
                    ↓ {node.aheadBehind.behind}
                  </span>
                </div>
              )}

              {node.pr && (
                <a
                  href={node.pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="branch-tree__pr"
                >
                  PR #{node.pr.number}: {node.pr.title}
                </a>
              )}

              {node.worktree && (
                <div className="branch-tree__worktree">
                  <span className="branch-tree__worktree-label">Worktree:</span>
                  <code>{node.worktree.path}</code>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .branch-tree {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
        }
        .branch-tree__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .branch-tree__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        .branch-tree__count {
          font-size: 12px;
          color: #666;
        }
        .branch-tree__list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .branch-tree__node {
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 3px solid transparent;
        }
        .branch-tree__node--active {
          border-left-color: #28a745;
          background: #f0fff0;
        }
        .branch-tree__node--main {
          background: #e8f4fc;
          border-left-color: #0066cc;
        }
        .branch-tree__node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .branch-tree__indent {
          font-family: monospace;
          color: #999;
        }
        .branch-tree__name {
          font-weight: 600;
          font-family: monospace;
          font-size: 13px;
        }
        .branch-tree__badges {
          display: flex;
          gap: 4px;
        }
        .branch-tree__badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .branch-tree__stats {
          display: flex;
          gap: 12px;
          margin-top: 6px;
          font-size: 12px;
          font-family: monospace;
        }
        .branch-tree__stat--ahead {
          color: #28a745;
        }
        .branch-tree__stat--behind {
          color: #dc3545;
        }
        .branch-tree__pr {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #0066cc;
          text-decoration: none;
        }
        .branch-tree__pr:hover {
          text-decoration: underline;
        }
        .branch-tree__worktree {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 11px;
          color: #666;
        }
        .branch-tree__worktree-label {
          font-weight: 500;
        }
        .branch-tree__worktree code {
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
