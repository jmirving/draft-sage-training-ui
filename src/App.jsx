import { useEffect, useMemo, useState } from "react";

const DEFAULT_INDEX_PATH = "/mock/experiment-index.json";
const STATUS_ORDER = ["planned", "running", "completed", "failed", "canceled"];
const STATUS_LABELS = {
  planned: "Planned",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

function getIndexPath() {
  const params = new URLSearchParams(window.location.search);
  return params.get("index") || DEFAULT_INDEX_PATH;
}

function resolveFromIndex(indexPath, relativePath) {
  if (!relativePath) {
    return null;
  }

  try {
    const baseUrl = new URL(indexPath, window.location.href);
    return new URL(relativePath, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function resolveFromSummary(summaryUrl, relativePath) {
  if (!summaryUrl || !relativePath) {
    return null;
  }

  try {
    return new URL(relativePath, summaryUrl).toString();
  } catch (error) {
    return null;
  }
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatNumber(value, digits = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(digits);
}

function buildFilterOptions(runs, key, order) {
  const values = runs
    .map((run) => run?.[key])
    .filter((value) => typeof value === "string" && value.length > 0);
  const unique = Array.from(new Set(values));

  if (order) {
    const ordered = order.filter((value) => unique.includes(value));
    const rest = unique.filter((value) => !order.includes(value));
    return ["all", ...ordered, ...rest];
  }

  return ["all", ...unique];
}

export default function App() {
  const indexPath = useMemo(() => getIndexPath(), []);

  const [indexData, setIndexData] = useState(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedRunId, setSelectedRunId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Load the experiment index once on page load or when the index path changes.
  useEffect(() => {
    let active = true;

    async function loadIndex() {
      setIndexLoading(true);
      setIndexError(null);

      try {
        const response = await fetch(indexPath);
        if (!response.ok) {
          throw new Error(`Index fetch failed (${response.status})`);
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setIndexData(data);
      } catch (error) {
        if (!active) {
          return;
        }

        setIndexError(error.message || "Unable to load experiment index.");
        setIndexData(null);
      } finally {
        if (active) {
          setIndexLoading(false);
        }
      }
    }

    loadIndex();

    return () => {
      active = false;
    };
  }, [indexPath]);

  const runs = useMemo(() => {
    if (!indexData || !Array.isArray(indexData.runs)) {
      return [];
    }

    return indexData.runs;
  }, [indexData]);

  const statusOptions = useMemo(
    () => buildFilterOptions(runs, "status", STATUS_ORDER),
    [runs]
  );
  const categoryOptions = useMemo(
    () => buildFilterOptions(runs, "category"),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const statusMatch = statusFilter === "all" || run.status === statusFilter;
      const categoryMatch =
        categoryFilter === "all" || run.category === categoryFilter;
      return statusMatch && categoryMatch;
    });
  }, [runs, statusFilter, categoryFilter]);

  // Keep selection aligned with the filtered list.
  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSelectedRunId(null);
      return;
    }

    const stillVisible = filteredRuns.some((run) => run.run_id === selectedRunId);
    if (!stillVisible) {
      setSelectedRunId(filteredRuns[0].run_id);
    }
  }, [filteredRuns, selectedRunId]);

  const selectedRun = useMemo(
    () => filteredRuns.find((run) => run.run_id === selectedRunId) || null,
    [filteredRuns, selectedRunId]
  );

  // Fetch the summary for the currently selected run.
  useEffect(() => {
    let active = true;

    async function loadSummary() {
      if (!selectedRun) {
        setSummaryData(null);
        setSummaryError(null);
        setSummaryLoading(false);
        return;
      }

      const summaryUrl = resolveFromIndex(indexPath, selectedRun.summary_path);
      if (!summaryUrl) {
        setSummaryData(null);
        setSummaryError("Missing summary path for this run.");
        setSummaryLoading(false);
        return;
      }

      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const response = await fetch(summaryUrl);
        if (!response.ok) {
          throw new Error(`Summary fetch failed (${response.status})`);
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setSummaryData({
          url: summaryUrl,
          data
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setSummaryError(error.message || "Unable to load summary.");
        setSummaryData(null);
      } finally {
        if (active) {
          setSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      active = false;
    };
  }, [indexPath, selectedRun]);

  const activeSummary = summaryData?.data || null;
  const summaryUrl = summaryData?.url || null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">DraftSage</p>
          <h1>Training Experiment Journal</h1>
          <p className="subtitle">
            Follow experiment runs, accuracy levers, and data windows with a
            single index file.
          </p>
        </div>
        <div className="header-meta">
          <div>
            <span className="label">Index path</span>
            <span className="value">{indexPath}</span>
          </div>
          <div>
            <span className="label">Updated</span>
            <span className="value">
              {indexData?.generated_at ? formatDate(indexData.generated_at) : "—"}
            </span>
          </div>
        </div>
      </header>

      <section className="panel controls">
        <div>
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : STATUS_LABELS[option] || option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All categories" : option}
              </option>
            ))}
          </select>
        </div>
        <div className="help">
          <p>
            Use <code>?index=/path/to/experiment-index.json</code> to point at a
            different output directory.
          </p>
        </div>
      </section>

      <main className="grid">
        <section className="panel list">
          <div className="panel-header">
            <h2>Runs</h2>
            <span className="pill">{filteredRuns.length} total</span>
          </div>

          {indexLoading && <div className="state">Loading experiment index…</div>}
          {!indexLoading && indexError && (
            <div className="state error">
              <p>Unable to load the experiment index.</p>
              <p className="muted">{indexError}</p>
            </div>
          )}
          {!indexLoading && !indexError && filteredRuns.length === 0 && (
            <div className="state empty">
              <p>No runs match the current filters.</p>
              <p className="muted">
                Try clearing the filters or verify the index schema.
              </p>
            </div>
          )}

          <div className="run-list">
            {filteredRuns.map((run, index) => (
              <button
                key={run.run_id}
                type="button"
                className={`run-card ${
                  run.run_id === selectedRunId ? "active" : ""
                }`}
                onClick={() => setSelectedRunId(run.run_id)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="run-card-top">
                  <div>
                    <h3>{run.display_name || run.run_id}</h3>
                    <p className="muted">{run.run_id}</p>
                  </div>
                  <span className={`status-badge status-${run.status}`}>
                    {STATUS_LABELS[run.status] || run.status}
                  </span>
                </div>
                <div className="run-card-meta">
                  <div>
                    <span className="label">Category</span>
                    <span className="value">{run.category || "—"}</span>
                  </div>
                  <div>
                    <span className="label">Accuracy</span>
                    <span className="value">
                      {formatNumber(run.metrics?.accuracy)}
                    </span>
                  </div>
                  <div>
                    <span className="label">Window</span>
                    <span className="value">
                      {run.dataset?.window
                        ? `${run.dataset.window.start} to ${run.dataset.window.end}`
                        : "—"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel detail">
          <div className="panel-header">
            <h2>Run detail</h2>
            {selectedRun && (
              <span className={`status-badge status-${selectedRun.status}`}>
                {STATUS_LABELS[selectedRun.status] || selectedRun.status}
              </span>
            )}
          </div>

          {!selectedRun && !indexLoading && (
            <div className="state empty">
              <p>Select a run to see its details.</p>
            </div>
          )}

          {selectedRun && summaryLoading && (
            <div className="state">Loading summary…</div>
          )}

          {selectedRun && summaryError && (
            <div className="state error">
              <p>Unable to load the run summary.</p>
              <p className="muted">{summaryError}</p>
            </div>
          )}

          {selectedRun && !summaryLoading && !summaryError && (
            <div className="detail-body">
              <div className="detail-header">
                <div>
                  <h3>{selectedRun.display_name || selectedRun.run_id}</h3>
                  <p className="muted">{selectedRun.run_id}</p>
                </div>
                {selectedRun.category && (
                  <span className="chip">{selectedRun.category}</span>
                )}
              </div>

              <p className="description">
                {activeSummary?.description || "No description yet."}
              </p>

              <div className="detail-grid">
                <div>
                  <span className="label">Created</span>
                  <span className="value">
                    {formatDate(activeSummary?.created_at)}
                  </span>
                </div>
                <div>
                  <span className="label">Updated</span>
                  <span className="value">
                    {formatDate(activeSummary?.updated_at)}
                  </span>
                </div>
                <div>
                  <span className="label">Progress</span>
                  <span className="value">
                    {activeSummary?.progress
                      ? `${activeSummary.progress.epoch}/${activeSummary.progress.epochs}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="label">Dataset</span>
                  <span className="value">
                    {activeSummary?.dataset?.window
                      ? `${activeSummary.dataset.window.start} to ${activeSummary.dataset.window.end}`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="metrics">
                <div>
                  <span className="label">Accuracy</span>
                  <span className="value">
                    {formatNumber(activeSummary?.metrics?.accuracy)}
                  </span>
                </div>
                <div>
                  <span className="label">Loss</span>
                  <span className="value">
                    {formatNumber(activeSummary?.metrics?.loss)}
                  </span>
                </div>
                <div>
                  <span className="label">Top-K</span>
                  <span className="value">
                    {activeSummary?.metrics?.top_k
                      ? `${activeSummary.metrics.top_k.k}: ${formatNumber(
                          activeSummary.metrics.top_k.accuracy
                        )}`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="links">
                <h4>Artifacts</h4>
                <div className="link-grid">
                  {activeSummary?.paths?.config && (
                    <a
                      href={resolveFromSummary(
                        summaryUrl,
                        activeSummary.paths.config
                      )}
                    >
                      config.json
                    </a>
                  )}
                  {activeSummary?.paths?.metrics && (
                    <a
                      href={resolveFromSummary(
                        summaryUrl,
                        activeSummary.paths.metrics
                      )}
                    >
                      metrics.json
                    </a>
                  )}
                  {activeSummary?.paths?.model && (
                    <a
                      href={resolveFromSummary(
                        summaryUrl,
                        activeSummary.paths.model
                      )}
                    >
                      model artifact
                    </a>
                  )}
                  {!activeSummary?.paths?.config &&
                    !activeSummary?.paths?.metrics &&
                    !activeSummary?.paths?.model && (
                      <p className="muted">No artifact paths published yet.</p>
                    )}
                </div>
              </div>

              {activeSummary?.dataset?.manifest_path && (
                <div className="links">
                  <h4>Dataset manifest</h4>
                  <a
                    href={resolveFromSummary(
                      summaryUrl,
                      activeSummary.dataset.manifest_path
                    )}
                  >
                    {activeSummary.dataset.manifest_path}
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
