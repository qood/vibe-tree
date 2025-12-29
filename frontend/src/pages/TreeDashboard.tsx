import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Plan,
  type ScanSnapshot,
  type TreeNode,
  type RepoPin,
  type AgentStatus,
} from "../lib/api";
import { wsClient } from "../lib/ws";

export default function TreeDashboard() {
  // Repo pins state
  const [repoPins, setRepoPins] = useState<RepoPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [newLocalPath, setNewLocalPath] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);

  // Main state
  const [plan, setPlan] = useState<Plan | null>(null);
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Agent state
  const [runningAgent, setRunningAgent] = useState<AgentStatus | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Load repo pins on mount
  useEffect(() => {
    api.getRepoPins().then((pins) => {
      setRepoPins(pins);
      // Auto-select the most recently used one
      if (pins.length > 0 && !selectedPinId) {
        setSelectedPinId(pins[0].id);
      }
    }).catch(console.error);
  }, []);

  // Load agent status on mount
  useEffect(() => {
    api.aiStatus().then(({ agents }) => {
      if (agents.length > 0) {
        setRunningAgent(agents[0]);
      }
    }).catch(console.error);
  }, []);

  // Get selected pin
  const selectedPin = repoPins.find((p) => p.id === selectedPinId) ?? null;

  // Auto-scan when pin is selected
  useEffect(() => {
    if (selectedPin && !snapshot) {
      handleScan(selectedPin.localPath);
    }
  }, [selectedPin?.id]);

  // Load plan and connect WS when snapshot is available
  useEffect(() => {
    if (!snapshot?.repoId) return;

    api.getCurrentPlan(snapshot.repoId).then(setPlan).catch(console.error);
    wsClient.connect(snapshot.repoId);

    const unsubScan = wsClient.on("scan.updated", (msg) => {
      setSnapshot(msg.data as ScanSnapshot);
    });

    const unsubAgentStarted = wsClient.on("agent.started", (msg) => {
      const data = msg.data as AgentStatus;
      setRunningAgent(data);
    });

    const unsubAgentFinished = wsClient.on("agent.finished", (msg) => {
      setRunningAgent(null);
      // Auto-rescan when agent finishes
      if (selectedPin) {
        handleScan(selectedPin.localPath);
      }
    });

    const unsubAgentStopped = wsClient.on("agent.stopped", () => {
      setRunningAgent(null);
    });

    return () => {
      unsubScan();
      unsubAgentStarted();
      unsubAgentFinished();
      unsubAgentStopped();
    };
  }, [snapshot?.repoId, selectedPin?.localPath]);

  const handleScan = useCallback(async (localPath: string) => {
    if (!localPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.scan(localPath);
      setSnapshot(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddRepoPin = async () => {
    if (!newLocalPath.trim()) return;
    try {
      const pin = await api.createRepoPin(newLocalPath.trim());
      setRepoPins((prev) => [pin, ...prev]);
      setSelectedPinId(pin.id);
      setNewLocalPath("");
      setShowAddNew(false);
      setSnapshot(null); // Will trigger auto-scan via useEffect
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSelectPin = async (id: number) => {
    setSelectedPinId(id);
    setSnapshot(null); // Reset to trigger new scan
    try {
      await api.useRepoPin(id);
    } catch (err) {
      console.error("Failed to mark pin as used:", err);
    }
  };

  const handleDeletePin = async (id: number) => {
    try {
      await api.deleteRepoPin(id);
      setRepoPins((prev) => prev.filter((p) => p.id !== id));
      if (selectedPinId === id) {
        setSelectedPinId(repoPins[0]?.id ?? null);
        setSnapshot(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRunClaude = async () => {
    if (!selectedPin) return;
    setAgentLoading(true);
    setError(null);
    try {
      const result = await api.aiStart(selectedPin.localPath, plan?.id);
      setRunningAgent({
        pid: result.pid,
        repoId: result.repoId,
        localPath: result.localPath,
        startedAt: result.startedAt,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleStopClaude = async () => {
    if (!runningAgent) return;
    setAgentLoading(true);
    try {
      await api.aiStop(runningAgent.pid);
      setRunningAgent(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleLogInstruction = async () => {
    if (!snapshot?.repoId || !instruction.trim()) return;
    try {
      await api.logInstruction({
        repoId: snapshot.repoId,
        planId: plan?.id,
        branchName: selectedNode?.branchName,
        kind: "user_instruction",
        contentMd: instruction,
      });
      setInstruction("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const getNodeChildren = (branchName: string): TreeNode[] => {
    if (!snapshot) return [];
    const childNames = snapshot.edges
      .filter((e) => e.parent === branchName)
      .map((e) => e.child);
    return snapshot.nodes.filter((n) => childNames.includes(n.branchName));
  };

  const renderNode = (node: TreeNode, depth: number = 0): JSX.Element => {
    const children = getNodeChildren(node.branchName);
    const isSelected = selectedNode?.branchName === node.branchName;
    const edge = snapshot?.edges.find((e) => e.child === node.branchName);

    return (
      <div key={node.branchName}>
        <div
          className={`tree-node ${isSelected ? "tree-node--selected" : ""} ${
            node.worktree?.isActive ? "tree-node--active" : ""
          }`}
          style={{ marginLeft: depth * 24 }}
          onClick={() => setSelectedNode(node)}
        >
          <div className="tree-node__header">
            <span className="tree-node__name">{node.branchName}</span>
            {edge?.isDesigned && (
              <span className="tree-node__badge tree-node__badge--designed">
                設計
              </span>
            )}
            {node.worktree?.isActive && (
              <span className="tree-node__badge tree-node__badge--agent">
                {node.worktree.activeAgent || "active"}
              </span>
            )}
            {node.worktree?.dirty && (
              <span className="tree-node__badge tree-node__badge--dirty">
                dirty
              </span>
            )}
            {node.pr && (
              <span
                className={`tree-node__badge tree-node__badge--pr tree-node__badge--${node.pr.state}`}
              >
                PR#{node.pr.number}
              </span>
            )}
            {node.pr?.isDraft && (
              <span className="tree-node__badge tree-node__badge--draft">
                draft
              </span>
            )}
            {node.pr?.reviewDecision && (
              <span
                className={`tree-node__badge tree-node__badge--review tree-node__badge--${node.pr.reviewDecision.toLowerCase()}`}
              >
                {node.pr.reviewDecision === "APPROVED"
                  ? "✓"
                  : node.pr.reviewDecision === "CHANGES_REQUESTED"
                  ? "✗"
                  : "○"}
              </span>
            )}
            {node.pr?.checks && (
              <span
                className={`tree-node__badge tree-node__badge--ci tree-node__badge--${node.pr.checks.toLowerCase()}`}
              >
                CI
              </span>
            )}
          </div>
          <div className="tree-node__meta">
            {node.aheadBehind && (
              <span className="tree-node__stat">
                ↑{node.aheadBehind.ahead} ↓{node.aheadBehind.behind}
              </span>
            )}
            {node.pr && (
              <span className="tree-node__changes">
                +{node.pr.additions || 0} -{node.pr.deletions || 0}
              </span>
            )}
            {node.pr?.labels?.map((label) => (
              <span key={label} className="tree-node__label">
                {label}
              </span>
            ))}
          </div>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  // Find root nodes (no parent or parent is default branch)
  const getRootNodes = (): TreeNode[] => {
    if (!snapshot) return [];
    const childBranches = new Set(snapshot.edges.map((e) => e.child));
    return snapshot.nodes.filter(
      (n) =>
        !childBranches.has(n.branchName) ||
        n.branchName === "main" ||
        n.branchName === "master"
    );
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Vibe Tree</h1>
        <div className="dashboard__nav">
          {snapshot?.repoId && (
            <>
              <span className="dashboard__repo">{snapshot.repoId}</span>
              <Link to={`/settings?repoId=${encodeURIComponent(snapshot.repoId)}`}>Settings</Link>
            </>
          )}
        </div>
      </header>

      {error && <div className="dashboard__error">{error}</div>}

      {/* Repo Selector */}
      <div className="dashboard__controls">
        <div className="repo-selector">
          <select
            value={selectedPinId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "new") {
                setShowAddNew(true);
              } else if (val) {
                handleSelectPin(Number(val));
              }
            }}
          >
            <option value="">Select a repo...</option>
            {repoPins.map((pin) => (
              <option key={pin.id} value={pin.id}>
                {pin.label || pin.repoId} ({pin.localPath})
              </option>
            ))}
            <option value="new">+ Add new repo...</option>
          </select>
          {selectedPin && (
            <button
              className="btn-delete"
              onClick={() => handleDeletePin(selectedPin.id)}
              title="Remove from list"
            >
              ×
            </button>
          )}
        </div>

        {showAddNew && (
          <div className="add-repo-form">
            <input
              type="text"
              placeholder="Local path (e.g., ~/projects/my-repo)"
              value={newLocalPath}
              onChange={(e) => setNewLocalPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRepoPin()}
            />
            <button onClick={handleAddRepoPin}>Add</button>
            <button onClick={() => setShowAddNew(false)}>Cancel</button>
          </div>
        )}

        <button
          onClick={() => selectedPin && handleScan(selectedPin.localPath)}
          disabled={loading || !selectedPin}
        >
          {loading ? "Scanning..." : "Scan"}
        </button>

        {/* Claude Agent Controls */}
        {selectedPin && (
          <div className="agent-controls">
            {runningAgent ? (
              <button
                className="btn-stop"
                onClick={handleStopClaude}
                disabled={agentLoading}
              >
                {agentLoading ? "Stopping..." : "Stop Claude"}
              </button>
            ) : (
              <button
                className="btn-run"
                onClick={handleRunClaude}
                disabled={agentLoading || !snapshot}
              >
                {agentLoading ? "Starting..." : "Run Claude"}
              </button>
            )}
            {runningAgent && (
              <span className="agent-status">
                Running (PID: {runningAgent.pid})
              </span>
            )}
          </div>
        )}

        {plan && (
          <span className="dashboard__plan">
            Plan: <strong>{plan.title}</strong>
            {plan.githubIssueUrl && (
              <a href={plan.githubIssueUrl} target="_blank" rel="noopener noreferrer">
                (Issue)
              </a>
            )}
          </span>
        )}
      </div>

      {/* Main Content */}
      {snapshot && (
        <div className="dashboard__main">
          {/* Left: Tree */}
          <div className="dashboard__tree">
            <div className="panel">
              <div className="panel__header">
                <h3>Branch Tree</h3>
                <span className="panel__count">{snapshot.nodes.length} branches</span>
              </div>
              <div className="tree-list">
                {getRootNodes()
                  .sort((a, b) => {
                    if (a.branchName === "main" || a.branchName === "master") return -1;
                    if (b.branchName === "main" || b.branchName === "master") return 1;
                    return 0;
                  })
                  .map((node) => renderNode(node))}
              </div>
            </div>

            {/* Warnings */}
            {snapshot.warnings.length > 0 && (
              <div className="panel panel--warnings">
                <div className="panel__header">
                  <h3>Warnings ({snapshot.warnings.length})</h3>
                </div>
                {snapshot.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`warning warning--${w.severity}`}
                  >
                    <strong>[{w.code}]</strong> {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="dashboard__details">
            {selectedNode ? (
              <div className="panel">
                <div className="panel__header">
                  <h3>{selectedNode.branchName}</h3>
                </div>

                {/* PR Info */}
                {selectedNode.pr && (
                  <div className="detail-section">
                    <h4>Pull Request</h4>
                    <a
                      href={selectedNode.pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      #{selectedNode.pr.number}: {selectedNode.pr.title}
                    </a>
                    <div className="detail-row">
                      <span>State: {selectedNode.pr.state}</span>
                      {selectedNode.pr.isDraft && <span>(Draft)</span>}
                    </div>
                    {selectedNode.pr.reviewDecision && (
                      <div className="detail-row">
                        Review: {selectedNode.pr.reviewDecision}
                      </div>
                    )}
                    {selectedNode.pr.checks && (
                      <div className="detail-row">CI: {selectedNode.pr.checks}</div>
                    )}
                    <div className="detail-row">
                      +{selectedNode.pr.additions} -{selectedNode.pr.deletions} (
                      {selectedNode.pr.changedFiles} files)
                    </div>
                    {selectedNode.pr.assignees && selectedNode.pr.assignees.length > 0 && (
                      <div className="detail-row">
                        Assignees: {selectedNode.pr.assignees.join(", ")}
                      </div>
                    )}
                    {selectedNode.pr.labels && selectedNode.pr.labels.length > 0 && (
                      <div className="detail-row">
                        Labels: {selectedNode.pr.labels.join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Worktree Info */}
                {selectedNode.worktree && (
                  <div className="detail-section">
                    <h4>Worktree</h4>
                    <code>{selectedNode.worktree.path}</code>
                    {selectedNode.worktree.isActive && (
                      <div className="detail-row">
                        Active: {selectedNode.worktree.activeAgent || "yes"}
                      </div>
                    )}
                    {selectedNode.worktree.dirty && (
                      <div className="detail-row warning--warn">Uncommitted changes</div>
                    )}
                  </div>
                )}

                {/* Ahead/Behind */}
                {selectedNode.aheadBehind && (
                  <div className="detail-section">
                    <h4>Status</h4>
                    <div className="detail-row">
                      Ahead: {selectedNode.aheadBehind.ahead}, Behind:{" "}
                      {selectedNode.aheadBehind.behind}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="panel panel--placeholder">
                <p>Select a branch to see details</p>
              </div>
            )}

            {/* Restart Panel */}
            {snapshot.restart && (
              <div className="panel panel--restart">
                <div className="panel__header">
                  <h3>Restart Session</h3>
                </div>
                <div className="detail-section">
                  <label>Terminal Command:</label>
                  <div className="copy-row">
                    <code>{snapshot.restart.cdCommand}</code>
                    <button
                      onClick={() =>
                        copyToClipboard(snapshot.restart!.cdCommand, "cd")
                      }
                    >
                      {copied === "cd" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="detail-section">
                  <label>Restart Prompt:</label>
                  <pre className="restart-prompt">
                    {snapshot.restart.restartPromptMd}
                  </pre>
                  <button
                    onClick={() =>
                      copyToClipboard(snapshot.restart!.restartPromptMd, "prompt")
                    }
                  >
                    {copied === "prompt" ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
              </div>
            )}

            {/* Instruction Logger */}
            <div className="panel">
              <div className="panel__header">
                <h3>Log Instruction</h3>
              </div>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Enter instruction for Claude..."
              />
              <button
                onClick={handleLogInstruction}
                disabled={!instruction.trim() || !snapshot?.repoId}
                className="btn-primary"
              >
                Log Instruction
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dashboard {
          min-height: 100vh;
          background: #f5f5f5;
        }
        .dashboard__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: white;
          border-bottom: 1px solid #ddd;
        }
        .dashboard__header h1 {
          margin: 0;
          font-size: 20px;
        }
        .dashboard__nav {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .dashboard__nav a {
          color: #0066cc;
          text-decoration: none;
        }
        .dashboard__repo {
          font-family: monospace;
          font-size: 14px;
          color: #666;
          background: #f0f0f0;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .dashboard__error {
          background: #fee;
          color: #c00;
          padding: 12px 24px;
          border-bottom: 1px solid #fcc;
        }
        .dashboard__controls {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          background: white;
          border-bottom: 1px solid #ddd;
          align-items: center;
          flex-wrap: wrap;
        }
        .repo-selector {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .repo-selector select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          min-width: 300px;
        }
        .add-repo-form {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .add-repo-form input {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          width: 300px;
        }
        .btn-delete {
          padding: 4px 8px;
          background: #fee;
          color: #c00;
          border: 1px solid #fcc;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        .agent-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-left: 12px;
          padding-left: 12px;
          border-left: 1px solid #ddd;
        }
        .btn-run {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-run:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .btn-stop {
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-stop:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .agent-status {
          font-size: 13px;
          color: #28a745;
          font-weight: 500;
        }
        .dashboard__controls button {
          padding: 8px 16px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .dashboard__controls button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .dashboard__plan {
          margin-left: auto;
          font-size: 14px;
          color: #666;
        }
        .dashboard__plan a {
          margin-left: 8px;
          color: #0066cc;
        }
        .dashboard__main {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 20px;
          padding: 20px 24px;
          max-width: 1600px;
          margin: 0 auto;
        }
        .dashboard__tree {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .dashboard__details {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
        }
        .panel--warnings {
          border-color: #f90;
        }
        .panel--restart {
          background: #e8f4f8;
          border-color: #b8d4e8;
        }
        .panel--placeholder {
          color: #999;
          text-align: center;
          padding: 40px;
        }
        .panel__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .panel__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        .panel__count {
          font-size: 12px;
          color: #666;
        }
        .tree-list {
          font-family: monospace;
          font-size: 13px;
        }
        .tree-node {
          padding: 8px 12px;
          margin-bottom: 4px;
          background: #f9f9f9;
          border-radius: 4px;
          cursor: pointer;
          border-left: 3px solid transparent;
        }
        .tree-node:hover {
          background: #f0f0f0;
        }
        .tree-node--selected {
          background: #e8f4fc;
          border-left-color: #0066cc;
        }
        .tree-node--active {
          border-left-color: #28a745;
        }
        .tree-node__header {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tree-node__name {
          font-weight: 600;
        }
        .tree-node__badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 500;
        }
        .tree-node__badge--designed {
          background: #9c27b0;
          color: white;
        }
        .tree-node__badge--agent {
          background: #28a745;
          color: white;
        }
        .tree-node__badge--dirty {
          background: #ff9800;
          color: white;
        }
        .tree-node__badge--pr {
          background: #2196F3;
          color: white;
        }
        .tree-node__badge--open {
          background: #28a745;
        }
        .tree-node__badge--closed {
          background: #6c757d;
        }
        .tree-node__badge--merged {
          background: #9c27b0;
        }
        .tree-node__badge--draft {
          background: #6c757d;
          color: white;
        }
        .tree-node__badge--review {
          font-weight: bold;
        }
        .tree-node__badge--approved {
          background: #28a745;
          color: white;
        }
        .tree-node__badge--changes_requested {
          background: #dc3545;
          color: white;
        }
        .tree-node__badge--ci {
          font-weight: bold;
        }
        .tree-node__badge--success {
          background: #28a745;
          color: white;
        }
        .tree-node__badge--failure {
          background: #dc3545;
          color: white;
        }
        .tree-node__badge--pending {
          background: #ffc107;
          color: black;
        }
        .tree-node__meta {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          font-size: 11px;
          color: #666;
        }
        .tree-node__stat {
          font-family: monospace;
        }
        .tree-node__changes {
          color: #28a745;
        }
        .tree-node__label {
          background: #e0e0e0;
          padding: 1px 4px;
          border-radius: 2px;
        }
        .warning {
          padding: 8px;
          margin-bottom: 8px;
          border-radius: 4px;
          font-size: 13px;
        }
        .warning--warn {
          background: #fff8e8;
        }
        .warning--error {
          background: #fee;
        }
        .detail-section {
          margin-bottom: 16px;
        }
        .detail-section h4 {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
        }
        .detail-section a {
          color: #0066cc;
          text-decoration: none;
        }
        .detail-section a:hover {
          text-decoration: underline;
        }
        .detail-section code {
          display: block;
          background: #f5f5f5;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          word-break: break-all;
        }
        .detail-section label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .detail-row {
          font-size: 13px;
          margin-top: 4px;
        }
        .copy-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .copy-row code {
          flex: 1;
        }
        .copy-row button {
          padding: 4px 12px;
          background: #e0e0e0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .restart-prompt {
          background: white;
          padding: 12px;
          border-radius: 4px;
          font-size: 11px;
          max-height: 200px;
          overflow: auto;
          white-space: pre-wrap;
          margin: 8px 0;
        }
        .panel textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 13px;
          resize: vertical;
          margin-bottom: 8px;
        }
        .btn-primary {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
