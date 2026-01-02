import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, type BranchNamingRule, type RepoPin } from "../lib/api";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const repoIdParam = searchParams.get("repoId");

  const [repoPins, setRepoPins] = useState<RepoPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [selectedPin, setSelectedPin] = useState<RepoPin | null>(null);
  const [rule, setRule] = useState<BranchNamingRule | null>(null);
  const [pattern, setPattern] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load pins
  useEffect(() => {
    api.getRepoPins().then((pins) => {
      setRepoPins(pins);
      // Auto-select if repoId is provided
      if (repoIdParam) {
        const pin = pins.find((p) => p.repoId === repoIdParam);
        if (pin) {
          setSelectedPinId(pin.id);
        }
      }
    }).catch(console.error);
  }, [repoIdParam]);

  // Load settings when pin is selected
  useEffect(() => {
    if (!selectedPinId) {
      setSelectedPin(null);
      setRule(null);
      return;
    }

    const pin = repoPins.find((p) => p.id === selectedPinId);
    if (!pin) return;

    setSelectedPin(pin);
    setDefaultBranch(pin.baseBranch || "");

    api
      .getBranchNaming(pin.repoId)
      .then((r) => {
        setRule(r);
        setPattern(r.pattern);
      })
      .catch((err) => {
        console.error(err);
        setRule({ pattern: "feat_{issueId}_{taskSlug}", description: "", examples: [] });
        setPattern("feat_{issueId}_{taskSlug}");
      });
  }, [selectedPinId, repoPins]);

  const handleSave = async () => {
    if (!selectedPin) return;
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      // Save branch naming rule
      await api.updateBranchNaming({
        repoId: selectedPin.repoId,
        pattern,
        description: "",
        examples: [],
      });

      // Save default branch
      if (defaultBranch) {
        await api.updateRepoPin(selectedPin.id, { baseBranch: defaultBranch });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", minHeight: "100vh", background: "#0f172a" }}>
      <h1 style={{ color: "#e5e7eb", marginBottom: "20px" }}>Settings</h1>

      <div style={{ marginBottom: "20px" }}>
        <Link to="/" style={{ color: "#60a5fa" }}>← Back</Link>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d", color: "#f87171", padding: "10px", marginBottom: "20px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ background: "#14532d", color: "#4ade80", padding: "10px", marginBottom: "20px", borderRadius: "4px" }}>
          Saved!
        </div>
      )}

      {/* Project Selection */}
      <div style={{ marginBottom: "20px", padding: "15px", background: "#1f2937", borderRadius: "8px", border: "1px solid #374151" }}>
        <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "8px" }}>PROJECT</label>
        <select
          value={selectedPinId || ""}
          onChange={(e) => setSelectedPinId(e.target.value ? parseInt(e.target.value) : null)}
          style={{ width: "100%", padding: "8px", background: "#111827", color: "#e5e7eb", border: "1px solid #374151", borderRadius: "4px" }}
        >
          <option value="">-- Select --</option>
          {repoPins.map((p) => (
            <option key={p.id} value={p.id}>
              {p.repoId}
            </option>
          ))}
        </select>
      </div>

      {selectedPin && (
        <>
          {/* Default Branch */}
          <div style={{ marginBottom: "20px", padding: "15px", background: "#1f2937", borderRadius: "8px", border: "1px solid #374151" }}>
            <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "8px" }}>DEFAULT BRANCH</label>
            <input
              type="text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              placeholder="develop"
              style={{ width: "100%", padding: "8px", fontFamily: "monospace", background: "#111827", color: "#e5e7eb", border: "1px solid #374151", borderRadius: "4px", boxSizing: "border-box" }}
            />
            <small style={{ color: "#6b7280", fontSize: "11px", marginTop: "4px", display: "block" }}>
              Task Instruction と Chat は表示されません
            </small>
          </div>

          {/* Branch Naming Pattern */}
          <div style={{ marginBottom: "20px", padding: "15px", background: "#1f2937", borderRadius: "8px", border: "1px solid #374151" }}>
            <label style={{ color: "#9ca3af", fontSize: "12px", display: "block", marginBottom: "8px" }}>BRANCH NAMING PATTERN</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="feat_{issueId}_{taskSlug}"
              style={{ width: "100%", padding: "8px", fontFamily: "monospace", background: "#111827", color: "#e5e7eb", border: "1px solid #374151", borderRadius: "4px", boxSizing: "border-box" }}
            />
            <small style={{ color: "#6b7280", fontSize: "11px", marginTop: "4px", display: "block" }}>
              {"{issueId}"} と {"{taskSlug}"} が使えます
            </small>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#4b5563" : "#22c55e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      )}
    </div>
  );
}
