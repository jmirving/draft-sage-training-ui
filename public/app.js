const STATUS_ORDER = ["planned", "running", "completed", "failed", "canceled"];
const DEFAULT_INDEX_PATHS = [
  "/.tmp/training-clean-2025-seriesid-index/experiment-index.json",
  "/.tmp/training-clean-2025-seriesid-baseline-elig/experiment-index.json",
  "/.tmp/training-clean-2025-weights-matrix-seriesid-elig/experiment-index.json",
  "/.tmp/training-clean-2025-weights-matrix-seriesid-elig-tight/experiment-index.json"
];
const DEFAULT_DATA_HOST = "https://draft-sage-training-data.onrender.com";
const STATUS_LABELS = {
  planned: "Planned",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};
const GROUP_LABELS = {
  baseline: "Baseline",
  "pb-role-weights-matrix": "Pick/Ban priors + role priors",
  "role-priors": "Role priors",
  "priors-role-priors": "Pick/Ban priors + role priors",
  "league-team-priors": "League/team priors",
  "timeaware-priors": "Time-aware priors"
};

const state = {
  indexData: null,
  indexLoading: false,
  indexError: null,
  summaryCache: new Map(),
  summaryLoading: false,
  summaryError: null,
  summaryInline: false,
  inspectionCache: new Map(),
  inspectionLoading: new Set(),
  inspectionError: new Map(),
  selectedRunId: null,
  statusFilter: "all",
  groupFilter: "all",
  metricKey: "accuracy",
  topKValue: null,
  sourceType: null,
  indexPath: null,
  indexUrl: null,
  refreshEnabled: true,
  refreshIntervalMs: 30000,
  refreshTimer: null,
  lastRefresh: null,
  refreshError: null,
  indexRefreshing: false,
  groupLabels: new Map(),
  indexSources: [],
  perSlotExpandedRunIds: new Set(),
  tableSort: {
    key: "metric",
    direction: "desc"
  }
};

const elements = {
  indexPath: document.getElementById("index-path"),
  indexUpdated: document.getElementById("index-updated"),
  indexRefreshed: document.getElementById("index-refreshed"),
  statusFilter: document.getElementById("status-filter"),
  groupFilter: document.getElementById("group-filter"),
  metricFilter: document.getElementById("metric-filter"),
  runningCount: document.getElementById("running-count"),
  runningNow: document.getElementById("running-now"),
  trueBaseline: document.getElementById("true-baseline"),
  baselineToBeat: document.getElementById("baseline-to-beat"),
  nextDecision: document.getElementById("next-decision"),
  tableCount: document.getElementById("table-count"),
  tableState: document.getElementById("table-state"),
  comparisonBody: document.getElementById("comparison-body"),
  comparisonHeaders: Array.from(
    document.querySelectorAll("#comparison-table thead th[data-sort]")
  ),
  detailState: document.getElementById("detail-state"),
  detailBody: document.getElementById("detail-body"),
  detailStatus: document.getElementById("detail-status"),
  ledgerCount: document.getElementById("ledger-count"),
  ledgerState: document.getElementById("ledger-state"),
  ledgerList: document.getElementById("ledger-list")
};

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

function formatNumber(value, digits = 4) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(digits);
}

function formatPercent(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function formatDelta(value, digits = 4) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function toCount(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizePerSlotMetrics(summary) {
  const rows = summary?.metrics?.per_slot_accuracy;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row, index) => {
      const slot =
        typeof row?.slot === "number" && row.slot > 0
          ? Math.floor(row.slot)
          : index + 1;
      const correct = toCount(row?.correct);
      const total = toCount(row?.total);
      const providedAccuracy =
        typeof row?.accuracy === "number" && !Number.isNaN(row.accuracy)
          ? row.accuracy
          : null;
      const accuracy =
        providedAccuracy !== null
          ? Math.min(1, Math.max(0, providedAccuracy))
          : total > 0
            ? correct / total
            : null;
      return {
        slot,
        slotId:
          typeof row?.slot_id === "string" && row.slot_id.length > 0
            ? row.slot_id
            : `slot_${slot.toString().padStart(2, "0")}`,
        canonicalSide: row?.canonical?.side || null,
        canonicalType: row?.canonical?.type || null,
        canonicalNum:
          typeof row?.canonical?.num === "number" && row.canonical.num > 0
            ? Math.floor(row.canonical.num)
            : null,
        observedBlue: toCount(row?.observed_side_counts?.blue),
        observedRed: toCount(row?.observed_side_counts?.red),
        correct,
        total,
        accuracy
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

function formatTeamSlotLabel(row) {
  const side = row?.canonicalSide;
  const type = row?.canonicalType;
  const num = row?.canonicalNum;
  if (!side && !type && !num) {
    return `Slot ${row?.slot ?? "?"}`;
  }
  const teamLabel =
    side === "blue" ? "Team 1" : side === "red" ? "Team 2" : "Team ?";
  const typeLabel = type ? titleCase(String(type)) : "Action";
  const numLabel = typeof num === "number" ? ` ${num}` : "";
  return `${teamLabel} ${typeLabel}${numLabel}`.trim();
}

function titleCase(value) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateQueryParam(path) {
  const url = new URL(window.location.href);
  if (path) {
    url.searchParams.set("index", path);
  } else {
    url.searchParams.delete("index");
  }
  window.history.replaceState({}, "", url);
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function resolveDefaultIndexPaths() {
  const dataHost = getQueryParam("dataHost");
  if (!dataHost && !DEFAULT_DATA_HOST) {
    return DEFAULT_INDEX_PATHS;
  }
  const normalized = (dataHost || DEFAULT_DATA_HOST).replace(/\/$/, "");
  return [`${normalized}/training/experiment-index.json`];
}

function withCacheBust(url) {
  const busted = new URL(url);
  busted.searchParams.set("_", Date.now().toString());
  return busted.toString();
}

function mergeMetrics(existing, incoming) {
  const merged = { ...(existing || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  });
  return merged;
}

function mergeDataset(existing, incoming) {
  const merged = { ...(existing || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  });
  return merged;
}

function mergeRunEntries(existing, incoming) {
  if (!existing) {
    return incoming;
  }
  const merged = { ...existing, ...incoming };
  merged.metrics = mergeMetrics(existing.metrics, incoming.metrics);
  merged.dataset = mergeDataset(existing.dataset, incoming.dataset);
  if (!incoming.group_id && existing.group_id) {
    merged.group_id = existing.group_id;
  }
  if (!incoming.variant_label && existing.variant_label) {
    merged.variant_label = existing.variant_label;
  }
  if (!incoming.summary_path && existing.summary_path) {
    merged.summary_path = existing.summary_path;
  }
  if (!incoming.summary_base_url && existing.summary_base_url) {
    merged.summary_base_url = existing.summary_base_url;
  }
  return merged;
}

function parseRunIdTimestamp(runId) {
  if (!runId || typeof runId !== "string") {
    return null;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(runId);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  const dashed = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/.exec(runId);
  if (dashed) {
    const [, date, hour, minute, second] = dashed;
    return `${date}T${hour}:${minute}:${second}Z`;
  }

  return null;
}

function getRuns() {
  if (!state.indexData || !Array.isArray(state.indexData.runs)) {
    return [];
  }
  return state.indexData.runs;
}

function getGroupKey(run) {
  return run?.group_id || run?.category || "uncategorized";
}

function getGroupLabelByKey(key) {
  if (!key) {
    return "Uncategorized";
  }
  return state.groupLabels.get(key) || GROUP_LABELS[key] || titleCase(key);
}

function getGroupLabel(run) {
  return getGroupLabelByKey(getGroupKey(run));
}

function getVariantLabel(run) {
  return run?.variant_label || run?.display_name || run?.run_id || "—";
}

function getMetricValue(run) {
  const metrics = run?.metrics;
  if (!metrics) {
    return null;
  }
  if (state.metricKey === "top_k") {
    const topK = metrics.top_k;
    if (topK && typeof topK.accuracy === "number") {
      return topK.accuracy;
    }
    return null;
  }
  const accuracy = metrics.accuracy;
  return typeof accuracy === "number" ? accuracy : null;
}

function getMetricLabel() {
  if (state.metricKey === "top_k") {
    const k = state.topKValue;
    return k ? `Top-${k} accuracy` : "Top-k accuracy";
  }
  return "Accuracy";
}

function computeDelta(value, baseline) {
  if (value === null || baseline === null) {
    return null;
  }
  return value - baseline;
}

function getCachedSummary(runId) {
  const entry = state.summaryCache.get(runId);
  return entry ? entry.data : null;
}

function formatProgress(summary) {
  const progress = summary?.progress;
  if (!progress) {
    return "—";
  }
  const epoch = progress.epoch;
  const epochs = progress.epochs;
  if (typeof epoch === "number" && typeof epochs === "number") {
    return `${epoch}/${epochs}`;
  }
  return "—";
}

function getRunSortTimestamp(run, fallbackIndex) {
  const parsed = parseRunIdTimestamp(run?.run_id);
  if (parsed) {
    const time = new Date(parsed).getTime();
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  return fallbackIndex;
}

function getRunUpdatedAt(run) {
  const summary = getCachedSummary(run?.run_id);
  if (summary?.updated_at) {
    return summary.updated_at;
  }
  return parseRunIdTimestamp(run?.run_id);
}

function getRunsByStatus(status) {
  return getRuns().filter((run) => run?.status === status);
}

function getFilteredRuns() {
  return getRuns().filter((run) => {
    const statusMatch =
      state.statusFilter === "all" || run.status === state.statusFilter;
    const groupMatch =
      state.groupFilter === "all" || getGroupKey(run) === state.groupFilter;
    return statusMatch && groupMatch;
  });
}

function getBestRunByMetric(runs) {
  let best = null;
  runs.forEach((run) => {
    const value = getMetricValue(run);
    if (value === null) {
      return;
    }
    if (!best || value > getMetricValue(best)) {
      best = run;
    }
  });
  if (best) {
    return best;
  }
  return runs.reduce((latest, run) => {
    if (!latest) {
      return run;
    }
    const latestTime = getRunSortTimestamp(latest, 0);
    const runTime = getRunSortTimestamp(run, 0);
    return runTime > latestTime ? run : latest;
  }, null);
}

function buildGroupStats(runs) {
  const groups = new Map();
  runs.forEach((run) => {
    const key = getGroupKey(run);
    const label = getGroupLabel(run);
    const entry = groups.get(key) || { key, label, runs: [] };
    entry.runs.push(run);
    groups.set(key, entry);
  });

  groups.forEach((entry) => {
    entry.best = getBestRunByMetric(entry.runs);
  });

  return groups;
}

function findRunById(runId) {
  return getRuns().find((run) => run?.run_id === runId) || null;
}

function getTrueBaselineRun() {
  const runId = state.indexData?.true_baseline_run_id;
  if (runId) {
    const run = findRunById(runId);
    if (run) {
      return run;
    }
  }
  const baselineRuns = getRuns().filter((run) => run?.category === "baseline");
  if (baselineRuns.length === 0) {
    return null;
  }
  return getBestRunByMetric(baselineRuns);
}

function getBaselineToBeatRun() {
  const runId = state.indexData?.baseline_to_beat_run_id;
  if (runId) {
    const run = findRunById(runId);
    if (run) {
      return run;
    }
  }
  const nonBaseline = getRuns().filter((run) => run?.category !== "baseline");
  if (nonBaseline.length > 0) {
    return getBestRunByMetric(nonBaseline);
  }
  return getBestRunByMetric(getRuns());
}

function renderDecisionCards() {
  const runs = getRuns();
  const running = runs.filter((run) => run?.status === "running");
  elements.runningCount.textContent = running.length.toString();
  elements.runningNow.innerHTML = "";
  if (running.length === 0) {
    elements.runningNow.innerHTML =
      '<div class="decision-item"><span class="decision-title">No active runs</span><span class="decision-meta">Queue is clear.</span></div>';
  } else {
    running.slice(0, 3).forEach((run) => {
      elements.runningNow.appendChild(renderDecisionItem(run, true));
    });
  }

  const trueBaseline = getTrueBaselineRun();
  elements.trueBaseline.innerHTML = "";
  if (trueBaseline) {
    elements.trueBaseline.appendChild(renderDecisionItem(trueBaseline, false, true));
  } else {
    elements.trueBaseline.innerHTML =
      '<div class="decision-item"><span class="decision-title">Not set</span><span class="decision-meta">Add a baseline run.</span></div>';
  }

  const baselineToBeat = getBaselineToBeatRun();
  elements.baselineToBeat.innerHTML = "";
  if (baselineToBeat) {
    elements.baselineToBeat.appendChild(
      renderDecisionItem(baselineToBeat, false, false)
    );
  } else {
    elements.baselineToBeat.innerHTML =
      '<div class="decision-item"><span class="decision-title">Not set</span><span class="decision-meta">Pick a target run.</span></div>';
  }

  elements.nextDecision.innerHTML = "";
  const baselineMetric = baselineToBeat ? getMetricValue(baselineToBeat) : null;
  const candidates = runs.filter((run) => run?.category !== "baseline");
  const bestChallenger = getBestRunByMetric(candidates);
  if (!baselineToBeat || !bestChallenger) {
    elements.nextDecision.innerHTML =
      '<div class="decision-item"><span class="decision-title">Waiting on data</span><span class="decision-meta">Run a comparison to get a cue.</span></div>';
  } else {
    const challengerMetric = getMetricValue(bestChallenger);
    const delta = computeDelta(challengerMetric, baselineMetric);
    const label = delta !== null && delta > 0 ? "New leader" : "Closest challenger";
    const item = document.createElement("div");
    item.className = "decision-item";

    const title = document.createElement("span");
    title.className = "decision-title";
    title.textContent = `${label}: ${getVariantLabel(bestChallenger)}`;

    const meta = document.createElement("span");
    meta.className = "decision-meta";
    const metricText =
      challengerMetric !== null
        ? `${getMetricLabel()}: ${formatNumber(challengerMetric)}`
        : `${getMetricLabel()}: —`;
    const deltaText =
      delta !== null ? `Delta vs target: ${formatDelta(delta)}` : "Delta vs target: —";
    meta.textContent = `${metricText} | ${deltaText}`;

    item.appendChild(title);
    item.appendChild(meta);
    item.addEventListener("click", () => selectRun(bestChallenger.run_id));
    elements.nextDecision.appendChild(item);
  }
}

function renderDecisionItem(run, includeProgress, showDataset) {
  const item = document.createElement("div");
  item.className = "decision-item";

  const title = document.createElement("span");
  title.className = "decision-title";
  title.textContent = run?.display_name || run?.run_id || "Untitled run";

  const meta = document.createElement("span");
  meta.className = "decision-meta";
  const metricValue = getMetricValue(run);
  const metricText =
    metricValue !== null
      ? `${getMetricLabel()}: ${formatNumber(metricValue)}`
      : `${getMetricLabel()}: —`;
  const datasetLabel = showDataset ? run?.dataset?.label || "—" : getGroupLabel(run);
  const summary = getCachedSummary(run?.run_id);
  const progress = includeProgress ? formatProgress(summary) : null;
  const progressText = includeProgress ? `Progress: ${progress}` : null;
  meta.textContent = [metricText, datasetLabel, progressText].filter(Boolean).join(" | ");

  item.appendChild(title);
  item.appendChild(meta);
  item.addEventListener("click", () => selectRun(run.run_id));
  return item;
}

function renderComparisonTable() {
  elements.comparisonBody.innerHTML = "";
  renderComparisonSortHeaders();
  const runs = getFilteredRuns();
  elements.tableCount.textContent = `${new Set(runs.map(getGroupKey)).size} groups`;

  if (state.indexLoading) {
    setTableState("Loading experiment index…");
    return;
  }

  if (state.indexError) {
    setTableState(`Unable to load index: ${state.indexError}`, "error");
    return;
  }

  if (!state.indexData) {
    setTableState("Load an index to get started.");
    return;
  }

  if (runs.length === 0) {
    setTableState("No runs match the current filters.", "empty");
    return;
  }

  clearTableState();

  const baselineToBeat = getBaselineToBeatRun();
  const baselineMetric = baselineToBeat ? getMetricValue(baselineToBeat) : null;
  const groups = Array.from(buildGroupStats(runs).values()).map((group, index) => {
    const metricValue = group.best ? getMetricValue(group.best) : null;
    const delta = computeDelta(metricValue, baselineMetric);
    const updatedRaw = getRunUpdatedAt(group.best);
    const updatedTs = updatedRaw ? new Date(updatedRaw).getTime() : Number.NEGATIVE_INFINITY;
    return {
      ...group,
      metricValue,
      delta,
      updatedRaw,
      updatedTs: Number.isNaN(updatedTs) ? Number.NEGATIVE_INFINITY : updatedTs,
      statusLabel: STATUS_LABELS[group.best?.status] || group.best?.status || "—",
      index
    };
  });
  groups.sort(compareComparisonRows);

  groups.forEach((group) => {
    const row = document.createElement("tr");
    if (group.best?.run_id === state.selectedRunId) {
      row.classList.add("active");
    }
    row.addEventListener("click", () => selectRun(group.best?.run_id));
    const deltaClass =
      group.delta === null
        ? "neutral"
        : group.delta > 0
          ? "positive"
          : group.delta < 0
            ? "negative"
            : "neutral";

    row.appendChild(createCell(group.label));
    row.appendChild(createCell(group.best ? getVariantLabel(group.best) : "—"));
    row.appendChild(
      createCell(group.metricValue !== null ? formatNumber(group.metricValue) : "—")
    );

    const deltaCell = document.createElement("td");
    const deltaSpan = document.createElement("span");
    deltaSpan.className = `delta ${deltaClass}`;
    deltaSpan.textContent = group.delta !== null ? formatDelta(group.delta) : "—";
    deltaCell.appendChild(deltaSpan);
    row.appendChild(deltaCell);

    row.appendChild(createCell(group.statusLabel));
    row.appendChild(createCell(formatDate(group.updatedRaw)));

    elements.comparisonBody.appendChild(row);
  });
}

function compareNullableNumbers(a, b, direction = "asc") {
  const aMissing = typeof a !== "number" || Number.isNaN(a);
  const bMissing = typeof b !== "number" || Number.isNaN(b);
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  return direction === "asc" ? a - b : b - a;
}

function compareNullableStrings(a, b) {
  const aValue = (a || "").toString().toLowerCase();
  const bValue = (b || "").toString().toLowerCase();
  return aValue.localeCompare(bValue);
}

function compareComparisonRows(a, b) {
  const direction = state.tableSort.direction;
  let base = 0;
  switch (state.tableSort.key) {
    case "group":
      base = compareNullableStrings(a.label, b.label);
      break;
    case "variant":
      base = compareNullableStrings(
        a.best ? getVariantLabel(a.best) : "",
        b.best ? getVariantLabel(b.best) : ""
      );
      break;
    case "metric":
      base = compareNullableNumbers(a.metricValue, b.metricValue, direction);
      break;
    case "delta":
      base = compareNullableNumbers(a.delta, b.delta, direction);
      break;
    case "status":
      base = compareNullableStrings(a.statusLabel, b.statusLabel);
      break;
    case "updated":
      base = compareNullableNumbers(a.updatedTs, b.updatedTs, direction);
      break;
    default:
      base = compareNullableStrings(a.label, b.label);
      break;
  }
  if (direction === "desc" && (state.tableSort.key === "group" || state.tableSort.key === "variant" || state.tableSort.key === "status")) {
    base *= -1;
  }
  if (base === 0) {
    return a.index - b.index;
  }
  return base;
}

function renderComparisonSortHeaders() {
  elements.comparisonHeaders.forEach((header) => {
    const key = header.dataset.sort || "";
    const label = header.dataset.label || header.textContent || "";
    const active = state.tableSort.key === key;
    const arrow = active ? (state.tableSort.direction === "asc" ? " ↑" : " ↓") : "";
    header.textContent = `${label}${arrow}`;
    header.classList.toggle("active-sort", active);
    header.classList.add("sortable-header");
  });
}

function renderLedger() {
  elements.ledgerList.innerHTML = "";
  const runs = getFilteredRuns();
  elements.ledgerCount.textContent = `${runs.length} total`;

  if (state.indexLoading) {
    setLedgerState("Loading experiment index…");
    return;
  }

  if (state.indexError) {
    setLedgerState(`Unable to load index: ${state.indexError}`, "error");
    return;
  }

  if (!state.indexData) {
    setLedgerState("Load an index to get started.");
    return;
  }

  if (runs.length === 0) {
    setLedgerState("No runs match the current filters.", "empty");
    return;
  }

  clearLedgerState();

  const ordered = runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => getRunSortTimestamp(b.run, b.index) - getRunSortTimestamp(a.run, a.index));

  ordered.forEach((entry, index) => {
    const run = entry.run;
    const item = document.createElement("div");
    item.className = "ledger-item";
    if (index === ordered.length - 1) {
      item.classList.add("is-last");
    }

    const marker = document.createElement("div");
    marker.className = "ledger-marker";
    const dot = document.createElement("div");
    dot.className = "ledger-dot";
    marker.appendChild(dot);

    const card = document.createElement("div");
    card.className = "ledger-card";
    if (run.run_id === state.selectedRunId) {
      card.classList.add("active");
    }

    const title = document.createElement("p");
    title.className = "ledger-title";
    title.textContent = run.display_name || run.run_id || "Untitled run";

    const meta = document.createElement("div");
    meta.className = "ledger-meta";
    const metric = getMetricValue(run);
    const metricLabel = metric !== null ? formatNumber(metric) : "—";
    const metricSpan = document.createElement("span");
    metricSpan.className = "ledger-metric";
    metricSpan.textContent = `${getMetricLabel()}: ${metricLabel}`;

    const groupSpan = document.createElement("span");
    groupSpan.textContent = getGroupLabel(run);

    const variantSpan = document.createElement("span");
    variantSpan.textContent = getVariantLabel(run);

    const statusSpan = document.createElement("span");
    statusSpan.textContent = STATUS_LABELS[run.status] || run.status || "—";

    const updatedSpan = document.createElement("span");
    updatedSpan.textContent = formatDate(getRunUpdatedAt(run));

    meta.appendChild(metricSpan);
    meta.appendChild(groupSpan);
    meta.appendChild(variantSpan);
    meta.appendChild(statusSpan);
    meta.appendChild(updatedSpan);

    card.appendChild(title);
    card.appendChild(meta);
    card.addEventListener("click", () => selectRun(run.run_id));

    item.appendChild(marker);
    item.appendChild(card);
    elements.ledgerList.appendChild(item);
  });
}

function renderDetail() {
  const runs = getFilteredRuns();
  const selectedRun = runs.find((run) => run.run_id === state.selectedRunId);

  elements.detailBody.innerHTML = "";

  if (!selectedRun) {
    elements.detailStatus.textContent = "—";
    elements.detailStatus.className = "status-badge";
    setDetailState("Select a run to see its details.");
    return;
  }

  elements.detailStatus.textContent =
    STATUS_LABELS[selectedRun.status] || selectedRun.status || "planned";
  elements.detailStatus.className =
    `status-badge status-${selectedRun.status || "planned"}`;

  if (state.summaryLoading) {
    setDetailState("Loading summary…");
    return;
  }

  if (state.summaryError) {
    setDetailState(`Unable to load summary: ${state.summaryError}`, "error");
    return;
  }

  const summaryEntry = state.summaryCache.get(selectedRun.run_id);
  if (!summaryEntry) {
    setDetailState("Summary not loaded for this run.", "error");
    return;
  }

  clearDetailState();

  const summary = summaryEntry.data;

  const header = document.createElement("div");
  header.className = "detail-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = selectedRun.display_name || selectedRun.run_id || "Untitled run";
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = `${getGroupLabel(selectedRun)} | ${getVariantLabel(selectedRun)}`;
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  header.appendChild(titleBlock);

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = getGroupLabel(selectedRun);
  header.appendChild(chip);

  const description = document.createElement("p");
  description.className = "description";
  description.textContent = summary?.description || "No description yet.";

  const detailGrid = document.createElement("div");
  detailGrid.className = "detail-grid";
  const fallbackDate = parseRunIdTimestamp(selectedRun.run_id);
  detailGrid.appendChild(
    createMetaField("Created", formatDate(summary?.created_at || fallbackDate))
  );
  detailGrid.appendChild(
    createMetaField("Updated", formatDate(summary?.updated_at || fallbackDate))
  );
  detailGrid.appendChild(createMetaField("Progress", formatProgress(summary)));
  detailGrid.appendChild(
    createMetaField("Dataset", summary?.dataset?.label || "—")
  );

  const metrics = document.createElement("div");
  metrics.className = "metrics";
  metrics.appendChild(
    createMetaField("Accuracy", formatNumber(summary?.metrics?.accuracy))
  );
  const topK = summary?.metrics?.top_k;
  if (topK && typeof topK.accuracy === "number") {
    const topKLabel = `Top-${topK.k ?? "k"} accuracy`;
    metrics.appendChild(createMetaField(topKLabel, formatNumber(topK.accuracy)));
  }
  metrics.appendChild(
    createMetaField("Loss", formatNumber(summary?.metrics?.loss))
  );

  const comparison = document.createElement("div");
  comparison.className = "metrics";

  const baselineToBeat = getBaselineToBeatRun();
  const baselineMetric = baselineToBeat ? getMetricValue(baselineToBeat) : null;
  const selectedMetric = getMetricValue(selectedRun);
  const deltaBaseline = computeDelta(selectedMetric, baselineMetric);
  comparison.appendChild(
    createMetaField(
      "Delta vs target",
      deltaBaseline !== null ? formatDelta(deltaBaseline) : "—"
    )
  );

  const groupStats = buildGroupStats(getRuns());
  const groupEntry = groupStats.get(getGroupKey(selectedRun));
  const groupBest = groupEntry?.best;
  const groupBestMetric = groupBest ? getMetricValue(groupBest) : null;
  const deltaGroup = computeDelta(selectedMetric, groupBestMetric);
  comparison.appendChild(
    createMetaField(
      "Delta vs group best",
      deltaGroup !== null ? formatDelta(deltaGroup) : "—"
    )
  );

  const artifacts = document.createElement("div");
  artifacts.className = "links";
  const artifactsTitle = document.createElement("h4");
  artifactsTitle.textContent = "Artifacts";
  artifacts.appendChild(artifactsTitle);

  const linkGrid = document.createElement("div");
  linkGrid.className = "link-grid";

  const artifactEntries = [
    { label: "config.json", path: summary?.paths?.config },
    { label: "metrics.json", path: summary?.paths?.metrics },
    { label: "model artifact", path: summary?.paths?.model }
  ].filter((entry) => entry.path);

  if (artifactEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No artifact paths published yet.";
    linkGrid.appendChild(empty);
  } else {
    artifactEntries.forEach((entry) => {
      linkGrid.appendChild(createArtifactLink(entry.label, entry.path, summaryEntry));
    });
  }

  artifacts.appendChild(linkGrid);

  elements.detailBody.appendChild(header);
  elements.detailBody.appendChild(description);
  elements.detailBody.appendChild(detailGrid);
  elements.detailBody.appendChild(metrics);
  elements.detailBody.appendChild(comparison);
  elements.detailBody.appendChild(renderPerSlotSection(summary, selectedRun.run_id));
  elements.detailBody.appendChild(artifacts);
  elements.detailBody.appendChild(renderInspectionSection(selectedRun, summaryEntry));
}

function renderPerSlotSection(summary, runId) {
  const section = document.createElement("section");
  section.className = "per-slot";

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("h4");
  title.textContent = "Per-Slot Accuracy";
  const count = document.createElement("span");
  count.className = "pill muted-pill";
  header.appendChild(title);
  header.appendChild(count);
  section.appendChild(header);

  const rows = normalizePerSlotMetrics(summary);
  count.textContent = rows.length > 0 ? `${rows.length} slots` : "Not published";

  const body = document.createElement("div");
  body.className = "per-slot-body";

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Per-slot metrics were not published for this run.";
    body.appendChild(empty);
    section.appendChild(body);
    return section;
  }

  const collapsedCount = 6;
  const expanded = state.perSlotExpandedRunIds.has(runId);
  const visibleRows = expanded ? rows : rows.slice(0, collapsedCount);

  const list = document.createElement("div");
  list.className = "per-slot-list";
  visibleRows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "per-slot-item";

    const name = document.createElement("span");
    name.className = "per-slot-name";
    name.textContent = formatTeamSlotLabel(row);

    const value = document.createElement("span");
    value.className = "per-slot-percent";
    value.textContent = formatPercent(row.accuracy);

    item.appendChild(name);
    item.appendChild(value);
    list.appendChild(item);
  });
  body.appendChild(list);

  if (rows.length > collapsedCount) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "per-slot-toggle";
    toggle.textContent = expanded
      ? "Show fewer slots"
      : `See all ${rows.length} slots`;
    toggle.addEventListener("click", () => {
      if (state.perSlotExpandedRunIds.has(runId)) {
        state.perSlotExpandedRunIds.delete(runId);
      } else {
        state.perSlotExpandedRunIds.add(runId);
      }
      renderDetail();
    });
    body.appendChild(toggle);
  }

  section.appendChild(body);
  return section;
}

function createMetaField(label, value) {
  const wrapper = document.createElement("div");

  const labelEl = document.createElement("span");
  labelEl.className = "label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "value";
  valueEl.textContent = value;

  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);

  return wrapper;
}

function createArtifactLink(label, relativePath, summaryEntry) {
  const wrapper = document.createElement("div");
  wrapper.className = "link-row";

  if (state.sourceType === "fetch") {
    const href = new URL(relativePath, summaryEntry.summaryUrl).toString();
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.target = "_blank";
    link.rel = "noreferrer";
    wrapper.appendChild(link);
    return wrapper;
  }

  const text = document.createElement("span");
  text.textContent = label;
  wrapper.appendChild(text);

  const note = document.createElement("span");
  note.className = "muted";
  note.textContent = "Serve over HTTP to open.";
  wrapper.appendChild(note);

  return wrapper;
}

function formatTopK(topK) {
  if (!Array.isArray(topK) || topK.length === 0) {
    return "—";
  }
  return topK
    .map((entry) => {
      if (!entry) {
        return null;
      }
      const name = entry.champion || "Unknown";
      const score =
        typeof entry.score === "number" && !Number.isNaN(entry.score)
          ? entry.score.toFixed(3)
          : "—";
      return `${name} (${score})`;
    })
    .filter(Boolean)
    .join(", ");
}

function formatDraftSequence(sequence) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return "—";
  }
  return sequence.map((entry) => (entry === 0 ? "—" : entry)).join(", ");
}

function createInspectionPredictionRow(label, value) {
  const row = document.createElement("div");
  row.className = "inspection-item-prediction-row";

  const key = document.createElement("span");
  key.className = "inspection-item-prediction-label";
  key.textContent = label;

  const content = document.createElement("span");
  content.className = "inspection-item-prediction-value";
  content.textContent = value;

  row.appendChild(key);
  row.appendChild(content);
  return row;
}

function renderInspectionSample(sample) {
  const item = document.createElement("div");
  item.className = "inspection-item";

  const header = document.createElement("div");
  header.className = "inspection-item-header";
  const slot = sample?.slot ?? "—";
  const side = sample?.side || "—";
  const actionType = sample?.action_type || "—";
  header.textContent = `Slot ${slot} · ${side} ${actionType}`;

  const meta = document.createElement("div");
  meta.className = "inspection-item-meta";
  const league = sample?.league || "—";
  const patch = sample?.patch || "—";
  const game = sample?.gameid || "—";
  meta.textContent = `${league} · Patch ${patch} · Game ${game}`;

  const topKEntries = Array.isArray(sample?.top_k) ? sample.top_k.filter(Boolean) : [];
  const predicted = topKEntries.length > 0 ? topKEntries[0].champion || "Unknown" : "—";
  const actual = sample?.target_champion || "—";
  const topKText = formatTopK(sample?.top_k);
  const hasComparablePrediction = predicted !== "—" && actual !== "—";
  const predictionState = hasComparablePrediction
    ? predicted === actual
      ? "Top-1 hit"
      : "Top-1 miss"
    : "Top-1 n/a";

  const predictionBlock = document.createElement("div");
  predictionBlock.className = "inspection-item-prediction";
  predictionBlock.appendChild(createInspectionPredictionRow("Model top-1", predicted));
  predictionBlock.appendChild(createInspectionPredictionRow("Actual", actual));
  predictionBlock.appendChild(createInspectionPredictionRow("Top-k", topKText));

  const predictionBadge = document.createElement("span");
  predictionBadge.className = "inspection-item-prediction-badge";
  if (hasComparablePrediction) {
    predictionBadge.classList.add(predicted === actual ? "hit" : "miss");
  }
  predictionBadge.textContent = predictionState;
  predictionBlock.appendChild(predictionBadge);

  const draft = document.createElement("div");
  draft.className = "inspection-item-draft";
  draft.textContent = `Draft: ${formatDraftSequence(sample?.draft_sequence)}`;

  const series = document.createElement("div");
  series.className = "inspection-item-series";
  const seriesUsed = Array.isArray(sample?.series_used_champions)
    ? sample.series_used_champions
    : [];
  series.textContent = seriesUsed.length
    ? `Prior series picks: ${seriesUsed.join(", ")}`
    : "Prior series picks: —";

  item.appendChild(header);
  item.appendChild(meta);
  item.appendChild(predictionBlock);
  item.appendChild(draft);
  item.appendChild(series);

  return item;
}

function renderInspectionSection(run, summaryEntry) {
  const summary = summaryEntry?.data;
  const section = document.createElement("div");
  section.className = "inspection";

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("h4");
  title.textContent = "Inspection Samples";
  const statusPill = document.createElement("span");
  statusPill.className = "pill muted-pill";
  const inspectionStatus = summary?.inspection_status || "missing";
  statusPill.textContent = titleCase(inspectionStatus);
  header.appendChild(title);
  header.appendChild(statusPill);
  section.appendChild(header);

  const body = document.createElement("div");
  body.className = "inspection-body";

  if (state.sourceType !== "fetch") {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Serve over HTTP to load inspection samples.";
    body.appendChild(note);
    section.appendChild(body);
    return section;
  }

  if (inspectionStatus === "failed") {
    const error = document.createElement("p");
    error.className = "muted";
    error.textContent = summary?.inspection_error || "Inspection samples failed to generate.";
    body.appendChild(error);
    section.appendChild(body);
    return section;
  }

  const inspectionPath = summary?.paths?.inspection_samples;
  if (inspectionStatus !== "available" || !inspectionPath) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Inspection samples not published for this run.";
    body.appendChild(empty);
    section.appendChild(body);
    return section;
  }

  const cached = state.inspectionCache.get(run.run_id);
  const loading = state.inspectionLoading.has(run.run_id);
  const error = state.inspectionError.get(run.run_id);

  if (!cached && !loading) {
    fetchInspectionSamples(run.run_id, summaryEntry, inspectionPath);
  }

  if (loading) {
    const loadingText = document.createElement("p");
    loadingText.className = "muted";
    loadingText.textContent = "Loading inspection samples…";
    body.appendChild(loadingText);
    section.appendChild(body);
    return section;
  }

  if (error) {
    const errorText = document.createElement("p");
    errorText.className = "muted";
    errorText.textContent = error;
    body.appendChild(errorText);
    section.appendChild(body);
    return section;
  }

  const payload = cached?.data;
  const meta = document.createElement("div");
  meta.className = "inspection-meta";
  meta.textContent = `Method: ${payload?.sample_method || "—"} · Size: ${
    payload?.sample_size ?? "—"
  } · Seed: ${payload?.sample_seed ?? "—"}`;
  body.appendChild(meta);

  const list = document.createElement("div");
  list.className = "inspection-list";
  const samples = Array.isArray(payload?.samples) ? payload.samples : [];
  if (samples.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No inspection samples found.";
    list.appendChild(empty);
  } else {
    samples.forEach((sample) => {
      list.appendChild(renderInspectionSample(sample));
    });
  }
  body.appendChild(list);

  section.appendChild(body);
  return section;
}

async function fetchInspectionSamples(runId, summaryEntry, relativePath) {
  if (!summaryEntry?.summaryUrl) {
    state.inspectionError.set(runId, "Missing summary URL for inspection samples.");
    return;
  }
  if (state.inspectionLoading.has(runId)) {
    return;
  }
  state.inspectionLoading.add(runId);
  state.inspectionError.delete(runId);
  renderDetail();

  try {
    const inspectionUrl = new URL(relativePath, summaryEntry.summaryUrl).toString();
    const response = await fetch(withCacheBust(inspectionUrl), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Inspection fetch failed (${response.status})`);
    }
    const data = await response.json();
    state.inspectionCache.set(runId, { data, inspectionUrl });
  } catch (error) {
    state.inspectionError.set(
      runId,
      error.message || "Unable to load inspection samples."
    );
  } finally {
    state.inspectionLoading.delete(runId);
    renderDetail();
  }
}

function renderFilters() {
  const runs = getRuns();
  const statusOptions = buildFilterOptions(
    runs.map((run) => run?.status),
    STATUS_ORDER
  );
  const groupOptions = buildGroupOptions(runs);

  populateSelect(elements.statusFilter, statusOptions, (option) =>
    option === "all" ? "All statuses" : STATUS_LABELS[option] || option
  );
  populateSelect(elements.groupFilter, groupOptions, (option) =>
    option === "all" ? "All groups" : getGroupLabelByKey(option)
  );

  if (!statusOptions.includes(state.statusFilter)) {
    state.statusFilter = "all";
    elements.statusFilter.value = "all";
  }

  if (!groupOptions.includes(state.groupFilter)) {
    state.groupFilter = "all";
    elements.groupFilter.value = "all";
  }

  updateMetricAvailability(runs);
}

function buildFilterOptions(values, order) {
  const filteredValues = values.filter(
    (value) => typeof value === "string" && value.length > 0
  );
  const unique = Array.from(new Set(filteredValues));

  if (order) {
    const ordered = order.filter((value) => unique.includes(value));
    const rest = unique.filter((value) => !order.includes(value));
    return ["all", ...ordered, ...rest];
  }

  return ["all", ...unique];
}

function buildGroupOptions(runs) {
  const values = runs.map((run) => getGroupKey(run));
  const unique = Array.from(new Set(values));
  return ["all", ...unique.sort((a, b) => getGroupLabelByKey(a).localeCompare(getGroupLabelByKey(b)))];
}

function populateSelect(select, options, formatter) {
  const current = select.value;
  select.innerHTML = "";

  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = formatter(option);
    select.appendChild(item);
  });

  if (options.includes(current)) {
    select.value = current;
  }
}

function updateMetricAvailability(runs) {
  const hasTopK = runs.some(
    (run) => run?.metrics?.top_k && typeof run.metrics.top_k.accuracy === "number"
  );
  state.topKValue = null;
  runs.forEach((run) => {
    if (run?.metrics?.top_k?.k) {
      state.topKValue = run.metrics.top_k.k;
    }
  });

  const topKOption = Array.from(elements.metricFilter.options).find(
    (option) => option.value === "top_k"
  );
  if (topKOption) {
    topKOption.disabled = !hasTopK;
  }
  if (!hasTopK && state.metricKey === "top_k") {
    state.metricKey = "accuracy";
    elements.metricFilter.value = "accuracy";
  }
}

function setIndexMeta(indexPath) {
  const sources = state.indexSources || [];
  if (sources.length > 1) {
    elements.indexPath.textContent = `Auto (${sources.length} sources)`;
  } else {
    elements.indexPath.textContent = indexPath || sources[0] || "—";
  }
  elements.indexUpdated.textContent = formatDate(state.indexData?.generated_at);
  elements.indexRefreshed.textContent = formatDate(state.lastRefresh);
}

function setTableState(message, type) {
  elements.tableState.textContent = message;
  elements.tableState.className = `state${type ? ` ${type}` : ""}`;
  elements.tableState.style.display = "block";
}

function clearTableState() {
  elements.tableState.style.display = "none";
}

function setLedgerState(message, type) {
  elements.ledgerState.textContent = message;
  elements.ledgerState.className = `state${type ? ` ${type}` : ""}`;
  elements.ledgerState.style.display = "block";
}

function clearLedgerState() {
  elements.ledgerState.style.display = "none";
}

function setDetailState(message, type) {
  elements.detailState.textContent = message;
  elements.detailState.className = `state${type ? ` ${type}` : ""}`;
  elements.detailState.style.display = "block";
}

function clearDetailState() {
  elements.detailState.style.display = "none";
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function syncSelection() {
  const runs = getFilteredRuns();
  if (runs.length === 0) {
    state.selectedRunId = null;
    return;
  }

  const stillVisible = runs.some((run) => run.run_id === state.selectedRunId);
  if (!stillVisible) {
    state.selectedRunId = runs[0].run_id;
  }
}

function selectRun(runId) {
  state.selectedRunId = runId;
  renderAll();

  const runs = getFilteredRuns();
  const selectedRun = runs.find((run) => run.run_id === runId);
  if (selectedRun) {
    loadSummary(selectedRun);
  }
}

function renderAll() {
  renderDecisionCards();
  renderComparisonTable();
  renderLedger();
  renderDetail();
}

async function fetchIndexData(path) {
  const indexUrl = new URL(path, window.location.href);
  const response = await fetch(withCacheBust(indexUrl.toString()), {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Index fetch failed (${response.status})`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    const legacy = buildLegacyIndex(data, {
      summaryPath: path,
      summaryUrl: indexUrl.toString()
    });
    return {
      indexData: legacy.indexData,
      summaries: legacy.summaries,
      summaryInline: true,
      indexPath: path,
      indexUrl: indexUrl.toString()
    };
  }

  return {
    indexData: data,
    summaries: null,
    summaryInline: false,
    indexPath: path,
    indexUrl: indexUrl.toString()
  };
}

function mergeIndexResults(results) {
  const runsById = new Map();
  const summaries = [];
  let baselineInfo = {
    true_baseline_run_id: null,
    baseline_to_beat_run_id: null,
    baseline_updated_at: null
  };
  let baselineTimestamp = 0;

  results.forEach((result) => {
    const data = result.indexData || {};
    const runs = Array.isArray(data.runs) ? data.runs : [];
    const indexUrl = result.indexUrl;
    const summaryInline = result.summaryInline;

    runs.forEach((run) => {
      if (!run?.run_id) {
        return;
      }
      const enriched = { ...run };
      if (indexUrl) {
        enriched.summary_base_url = indexUrl;
      }
      const existing = runsById.get(run.run_id);
      runsById.set(run.run_id, mergeRunEntries(existing, enriched));
    });

    if (Array.isArray(result.summaries)) {
      summaries.push(...result.summaries);
    }

    const candidateUpdated = data.baseline_updated_at;
    const candidateTimestamp = candidateUpdated
      ? new Date(candidateUpdated).getTime()
      : 0;
    const hasBaselinePointers =
      data.true_baseline_run_id || data.baseline_to_beat_run_id;
    if (hasBaselinePointers && candidateTimestamp >= baselineTimestamp) {
      baselineTimestamp = candidateTimestamp;
      baselineInfo = {
        true_baseline_run_id: data.true_baseline_run_id || null,
        baseline_to_beat_run_id: data.baseline_to_beat_run_id || null,
        baseline_updated_at: data.baseline_updated_at || null
      };
    }
  });

  const combined = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    runs: Array.from(runsById.values()).sort((a, b) =>
      (a.run_id || "").localeCompare(b.run_id || "")
    )
  };
  if (baselineInfo.true_baseline_run_id) {
    combined.true_baseline_run_id = baselineInfo.true_baseline_run_id;
  }
  if (baselineInfo.baseline_to_beat_run_id) {
    combined.baseline_to_beat_run_id = baselineInfo.baseline_to_beat_run_id;
  }
  if (baselineInfo.baseline_updated_at) {
    combined.baseline_updated_at = baselineInfo.baseline_updated_at;
  }

  return {
    indexData: combined,
    summaries,
    summaryInline: summaries.length > 0,
    indexPath: results[0]?.indexPath || null,
    indexUrl: results[0]?.indexUrl || null,
    indexSources: results.map((result) => result.indexPath).filter(Boolean)
  };
}

async function fetchIndexSources(paths) {
  const results = await Promise.allSettled(paths.map((path) => fetchIndexData(path)));
  const successes = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  if (successes.length === 0) {
    throw new Error("Unable to load any experiment indexes.");
  }
  return mergeIndexResults(successes);
}

function buildLegacyIndex(summaryRows, summaryLocation) {
  const generatedAt = new Date().toISOString();
  const runs = [];
  const summaries = [];

  summaryRows.forEach((row) => {
    const runId = row.run_id || row.runId || row.id || row.experiment;
    if (!runId) {
      return;
    }

    const experiment = row.experiment || runId;
    const category = experiment.startsWith("exp-")
      ? experiment.replace(/^exp-/, "")
      : "legacy";
    const runDir = row.experiment && row.run_id ? `${row.experiment}/${row.run_id}` : null;
    const inferredDate = parseRunIdTimestamp(runId);

    runs.push({
      run_id: runId,
      display_name: experiment,
      status: "completed",
      category,
      group_id: category,
      metrics: {
        accuracy: row.test_accuracy ?? null,
        loss: row.test_loss ?? null,
        best_val_loss: row.best_val_loss ?? null
      },
      summary_path: summaryLocation.summaryPath
    });

    summaries.push({
      run_id: runId,
      summaryUrl: summaryLocation.summaryUrl,
      data: {
        schema_version: "1.0",
        run_id: runId,
        display_name: experiment,
        status: "completed",
        created_at: inferredDate,
        updated_at: inferredDate,
        description: row.feature_set
          ? `Feature set: ${row.feature_set.join(", ")}`
          : "Legacy training run summary.",
        category,
        group_id: category,
        progress: row.epochs ? { epoch: row.epochs, epochs: row.epochs } : null,
        metrics: {
          accuracy: row.test_accuracy ?? null,
          loss: row.test_loss ?? null,
          best_val_loss: row.best_val_loss ?? null
        },
        samples: {
          train: row.train_samples ?? null,
          val: row.val_samples ?? null,
          test: row.test_samples ?? null
        },
        paths: runDir
          ? {
              config: `${runDir}/config.json`,
              metrics: `${runDir}/metrics.json`,
              model: `${runDir}/model.pth`
            }
          : {}
      }
    });
  });

  return {
    indexData: {
      schema_version: "1.0",
      generated_at: generatedAt,
      runs
    },
    summaries
  };
}

function applyIndexResult(result, options = {}) {
  const { preserveSelection = false, preserveFilters = false, updateUrl = false } =
    options;
  const priorSelection = preserveSelection ? state.selectedRunId : null;
  const priorStatus = preserveFilters ? state.statusFilter : "all";
  const priorGroup = preserveFilters ? state.groupFilter : "all";

  state.indexData = result.indexData;
  state.sourceType = "fetch";
  state.summaryInline = result.summaryInline;
  state.indexPath = result.indexPath;
  state.indexUrl = result.indexUrl;
  state.indexSources = result.indexSources || [result.indexPath].filter(Boolean);
  state.summaryCache.clear();
  state.inspectionCache.clear();
  state.inspectionLoading.clear();
  state.inspectionError.clear();
  if (Array.isArray(result.summaries)) {
    result.summaries.forEach((entry) => state.summaryCache.set(entry.run_id, entry));
  }

  state.selectedRunId = preserveSelection ? priorSelection : null;
  state.statusFilter = preserveFilters ? priorStatus : "all";
  state.groupFilter = preserveFilters ? priorGroup : "all";

  rebuildGroupLabels();

  if (updateUrl) {
    updateQueryParam(state.indexPath);
  }
  setIndexMeta(state.indexPath);
}

function rebuildGroupLabels() {
  state.groupLabels = new Map();
  getRuns().forEach((run) => {
    const key = getGroupKey(run);
    if (!state.groupLabels.has(key)) {
      state.groupLabels.set(key, GROUP_LABELS[key] || titleCase(key));
    }
  });
}

async function fetchSummary(run, options = {}) {
  const { silent = false } = options;

  if (state.summaryInline) {
    if (!silent) {
      state.summaryLoading = false;
      state.summaryError = null;
      renderDetail();
    }
    return;
  }

  if (!run?.summary_path) {
    if (!silent) {
      state.summaryError = "Missing summary path for this run.";
      state.summaryLoading = false;
      renderDetail();
    }
    return;
  }

  if (!silent) {
    state.summaryLoading = true;
    state.summaryError = null;
    renderDetail();
  }

  try {
    const summaryBaseUrl = run.summary_base_url || state.indexUrl;
    const summaryUrl = new URL(run.summary_path, summaryBaseUrl).toString();
    const response = await fetch(withCacheBust(summaryUrl), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Summary fetch failed (${response.status})`);
    }
    const data = await response.json();
    state.summaryCache.set(run.run_id, {
      data,
      summaryUrl
    });
  } catch (error) {
    if (!silent) {
      state.summaryError = error.message || "Unable to load summary.";
    }
  } finally {
    if (!silent) {
      state.summaryLoading = false;
      renderDetail();
    }
  }
}

async function loadSummary(run) {
  await fetchSummary(run);
}

async function loadIndexFromFetch(path, updateUrl) {
  const paths = Array.isArray(path) ? path : [path];
  state.indexLoading = true;
  state.indexError = null;
  state.indexData = null;
  state.summaryCache.clear();
  state.selectedRunId = null;
  state.refreshError = null;
  state.indexSources = paths;
  renderAll();

  try {
    const result = await fetchIndexSources(paths);
    state.lastRefresh = new Date().toISOString();
    applyIndexResult(result, {
      preserveSelection: false,
      preserveFilters: false,
      updateUrl
    });
  } catch (error) {
    state.indexError = error.message || "Unable to load experiment index.";
    state.sourceType = null;
    state.summaryInline = false;
    state.indexPath = null;
    state.indexUrl = null;
    state.lastRefresh = null;
    state.indexSources = [];
    setIndexMeta(null);
  } finally {
    state.indexLoading = false;
    renderFilters();
    syncSelection();
    renderAll();
    if (state.selectedRunId) {
      const run = getFilteredRuns().find((item) => item.run_id === state.selectedRunId);
      if (run) {
        loadSummary(run);
      }
    }
    updateRefreshTimer();
    if (state.indexData) {
      prefetchSummaries(getRuns().filter((run) => run.status === "running"));
    }
  }
}

async function prefetchSummaries(runs) {
  if (state.summaryInline || !Array.isArray(runs) || runs.length === 0) {
    return;
  }

  const targets = runs.filter((run) => run?.summary_path);
  if (targets.length === 0) {
    return;
  }

  await Promise.all(
    targets.map((run) =>
      fetchSummary(run, {
        silent: true
      })
    )
  );

  renderAll();
}

function canRefreshIndex() {
  return Boolean(state.indexSources.length > 0 && state.sourceType === "fetch");
}

function updateRefreshTimer() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (!state.refreshEnabled || !canRefreshIndex()) {
    return;
  }

  state.refreshTimer = window.setInterval(() => {
    refreshIndex();
  }, state.refreshIntervalMs);
}

async function refreshIndex() {
  if (!canRefreshIndex() || state.indexRefreshing) {
    return;
  }

  state.indexRefreshing = true;
  state.refreshError = null;

  try {
    const result = await fetchIndexSources(state.indexSources);
    state.lastRefresh = new Date().toISOString();
    applyIndexResult(result, {
      preserveSelection: true,
      preserveFilters: true,
      updateUrl: false
    });

    renderFilters();
    syncSelection();
    renderAll();

    if (state.selectedRunId) {
      const run = getRuns().find((item) => item.run_id === state.selectedRunId);
      if (run) {
        loadSummary(run);
      }
    }

    await prefetchSummaries(getRuns().filter((run) => run.status === "running"));
  } catch (error) {
    state.refreshError = error.message || "Unable to refresh index.";
  } finally {
    state.indexRefreshing = false;
    setIndexMeta(state.indexPath);
  }
}

function attachEventHandlers() {
  elements.statusFilter.addEventListener("change", (event) => {
    state.statusFilter = event.target.value;
    syncSelection();
    renderAll();
  });

  elements.groupFilter.addEventListener("change", (event) => {
    state.groupFilter = event.target.value;
    syncSelection();
    renderAll();
  });

  elements.metricFilter.addEventListener("change", (event) => {
    state.metricKey = event.target.value;
    renderAll();
  });

  elements.comparisonHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (!key) {
        return;
      }
      if (state.tableSort.key === key) {
        state.tableSort.direction =
          state.tableSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.tableSort.key = key;
        state.tableSort.direction = key === "group" || key === "variant" || key === "status"
          ? "asc"
          : "desc";
      }
      renderComparisonTable();
    });
  });
}

function init() {
  attachEventHandlers();
  state.refreshIntervalMs = 30000;
  state.metricKey = elements.metricFilter.value || "accuracy";
  renderFilters();
  renderAll();

  loadIndexFromFetch(resolveDefaultIndexPaths(), false);
}

init();
