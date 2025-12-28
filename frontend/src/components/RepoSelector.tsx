import { useState } from "react";
import { api, type Repo } from "../lib/api";

interface RepoSelectorProps {
  repos: Repo[];
  selectedRepoId: number | null;
  onSelect: (repoId: number | null) => void;
  onRepoCreated?: (repo: Repo) => void;
  showAddRepo?: boolean;
}

export function RepoSelector({
  repos,
  selectedRepoId,
  onSelect,
  onRepoCreated,
  showAddRepo = true,
}: RepoSelectorProps) {
  const [newRepoPath, setNewRepoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRepo = async () => {
    if (!newRepoPath) return;
    setLoading(true);
    setError(null);
    try {
      const repo = await api.createRepo(newRepoPath);
      onRepoCreated?.(repo);
      onSelect(repo.id);
      setNewRepoPath("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="repo-selector">
      <div className="repo-selector__select-row">
        <label htmlFor="repo-select">Repository:</label>
        <select
          id="repo-select"
          value={selectedRepoId ?? ""}
          onChange={(e) => onSelect(Number(e.target.value) || null)}
          className="repo-selector__select"
        >
          <option value="">-- Select a repo --</option>
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.path})
            </option>
          ))}
        </select>
      </div>

      {showAddRepo && (
        <div className="repo-selector__add-row">
          <input
            type="text"
            placeholder="Add new repo path (e.g., /path/to/repo)..."
            value={newRepoPath}
            onChange={(e) => setNewRepoPath(e.target.value)}
            className="repo-selector__input"
            onKeyDown={(e) => e.key === "Enter" && handleCreateRepo()}
          />
          <button
            onClick={handleCreateRepo}
            disabled={loading || !newRepoPath}
            className="repo-selector__button"
          >
            {loading ? "Adding..." : "Add Repo"}
          </button>
        </div>
      )}

      {error && <div className="repo-selector__error">{error}</div>}

      <style>{`
        .repo-selector {
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .repo-selector__select-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .repo-selector__select-row label {
          font-weight: 500;
          white-space: nowrap;
        }
        .repo-selector__select {
          flex: 1;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }
        .repo-selector__add-row {
          display: flex;
          gap: 8px;
        }
        .repo-selector__input {
          flex: 1;
          padding: 8px 12px;
        }
        .repo-selector__button {
          padding: 8px 16px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
        }
        .repo-selector__button:hover:not(:disabled) {
          background: #0052a3;
        }
        .repo-selector__button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .repo-selector__error {
          margin-top: 8px;
          padding: 8px 12px;
          background: #fee;
          color: #c00;
          border-radius: 4px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
