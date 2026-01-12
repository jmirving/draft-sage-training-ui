const STATUS_ORDER = ["planned", "running", "completed", "failed", "canceled"];
const DEFAULT_INDEX_PATH = "/.tmp/training-clean-2025-all/experiment-index.json";
const STATUS_LABELS = {
  planned: "Planned",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

const state = {
  indexData: null,
  indexLoading: false,
  indexError: null,
  summaryCache: new Map(),
  summaryLoading: false,
  summaryError: null,
  summaryInline: false,
  selectedRunId: null,
  statusFilter: "all",
  categoryFilter: "all",
  sourceType: null,
  indexPath: null,
  indexUrl: null,
  refreshEnabled: false,
  refreshIntervalMs: 30000,
  refreshTimer: null,
  lastRefresh: null,
  refreshError: null,
  indexRefreshing: false
};

const elements = {
  indexPath: document.getElementById("index-path"),
  indexUpdated: document.getElementById("index-updated"),
  indexRefreshed: document.getElementById("index-refreshed"),
  statusFilter: document.getElementById("status-filter"),
  categoryFilter: document.getElementById("category-filter"),
  runCount: document.getElementById("run-count"),
  runList: document.getElementById("run-list"),
  listState: document.getElementById("list-state"),
  detailState: document.getElementById("detail-state"),
  detailBody: document.getElementById("detail-body"),
  detailStatus: document.getElementById("detail-status"),
  bestGrid: document.getElementById("best-grid"),
  bestCount: document.getElementById("best-count"),
  indexInput: document.getElementById("index-input"),
  loadIndex: document.getElementById("load-index"),
  loadLegacy: document.getElementById("load-legacy"),
  legacyFile: document.getElementById("legacy-file"),
  refreshButton: document.getElementById("refresh-index"),
  autoRefresh: document.getElementById("auto-refresh"),
  refreshInterval: document.getElementById("refresh-interval"),
  refreshStatus: document.getElementById("refresh-status")
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

function formatNumber(value, digits = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(digits);
}

function formatInterval(ms) {
  if (!ms || Number.isNaN(ms)) {
    return "—";
  }
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  return `${Math.round(ms / 60000)}m`;
}

function withCacheBust(url) {
  const busted = new URL(url);
  busted.searchParams.set("_", Date.now().toString());
  return busted.toString();
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

function updateQueryParam(path) {
  const url = new URL(window.location.href);
  if (path) {
    url.searchParams.set("index", path);
  } else {
    url.searchParams.delete("index");
  }
  window.history.replaceState({}, "", url);
}

function inferLegacyDatasetLabel(rows) {
  const hasPatchWindow = rows.some(
    (row) => row.patch_window || (Array.isArray(row.patches) && row.patches.length)
  );
  if (hasPatchWindow) {
    return "Patch window";
  }
  return "Clean 2025";
}

// Map legacy summary.json arrays into the v1 index + summary cache.
function buildLegacyIndex(summaryRows, summaryLocation) {
  const generatedAt = new Date().toISOString();
  const runs = [];
  const summaries = [];
  const legacyDataset = { label: inferLegacyDatasetLabel(summaryRows) };

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
      dataset: legacyDataset,
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
        dataset: legacyDataset,
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

function applyIndexResult(result, options = {}) {
  const { preserveSelection = false, preserveFilters = false, updateUrl = false } =
    options;
  const priorSelection = preserveSelection ? state.selectedRunId : null;
  const priorStatus = preserveFilters ? state.statusFilter : "all";
  const priorCategory = preserveFilters ? state.categoryFilter : "all";

  state.indexData = result.indexData;
  state.sourceType = "fetch";
  state.summaryInline = result.summaryInline;
  state.indexPath = result.indexPath;
  state.indexUrl = result.indexUrl;
  state.summaryCache.clear();
  if (Array.isArray(result.summaries)) {
    result.summaries.forEach((entry) => state.summaryCache.set(entry.run_id, entry));
  }

  state.selectedRunId = preserveSelection ? priorSelection : null;
  state.statusFilter = preserveFilters ? priorStatus : "all";
  state.categoryFilter = preserveFilters ? priorCategory : "all";

  if (updateUrl) {
    updateQueryParam(state.indexPath);
  }
  elements.indexInput.value = state.indexPath;
  setIndexMeta(state.indexPath);
}

function formatDatasetValue(summary, fallbackRunId) {
  if (summary?.dataset?.label) {
    return summary.dataset.label;
  }

  if (summary?.dataset?.window) {
    return `${summary.dataset.window.start} to ${summary.dataset.window.end}`;
  }

  const samples = summary?.samples;
  if (samples && (samples.train || samples.val || samples.test)) {
    const parts = [];
    if (samples.train) {
      parts.push(`train ${samples.train}`);
    }
    if (samples.val) {
      parts.push(`val ${samples.val}`);
    }
    if (samples.test) {
      parts.push(`test ${samples.test}`);
    }
    return `samples: ${parts.join(" / ")}`;
  }

  const inferred = parseRunIdTimestamp(fallbackRunId);
  if (inferred) {
    return `run date ${formatDate(inferred)}`;
  }

  return "—";
}

function getRunAccuracy(run) {
  const accuracy = run?.metrics?.accuracy;
  return typeof accuracy === "number" && !Number.isNaN(accuracy) ? accuracy : null;
}

function getRunLoss(run) {
  const loss = run?.metrics?.loss;
  return typeof loss === "number" && !Number.isNaN(loss) ? loss : null;
}

function compareRuns(a, b) {
  const aAcc = getRunAccuracy(a);
  const bAcc = getRunAccuracy(b);
  if (aAcc !== null && bAcc !== null) {
    return bAcc - aAcc;
  }
  if (aAcc !== null) {
    return -1;
  }
  if (bAcc !== null) {
    return 1;
  }

  const aLoss = getRunLoss(a);
  const bLoss = getRunLoss(b);
  if (aLoss !== null && bLoss !== null) {
    return aLoss - bLoss;
  }
  if (aLoss !== null) {
    return -1;
  }
  if (bLoss !== null) {
    return 1;
  }

  return 0;
}

function getBestRunsByCategory(runs) {
  const bestByCategory = new Map();

  runs.forEach((run) => {
    if (run?.status && run.status !== "completed") {
      return;
    }

    const hasMetrics = getRunAccuracy(run) !== null || getRunLoss(run) !== null;
    if (!hasMetrics) {
      return;
    }

    const category = run.category || "uncategorized";
    const existing = bestByCategory.get(category);
    if (!existing || compareRuns(run, existing) < 0) {
      bestByCategory.set(category, run);
    }
  });

  return Array.from(bestByCategory.entries())
    .map(([category, run]) => ({ category, run }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function getRunCountsByCategory(runs) {
  const counts = new Map();

  runs.forEach((run) => {
    const category = run?.category || "uncategorized";
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  return counts;
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

function getRuns() {
  if (!state.indexData || !Array.isArray(state.indexData.runs)) {
    return [];
  }

  return state.indexData.runs;
}

function getFilteredRuns() {
  return getRuns().filter((run) => {
    const statusMatch =
      state.statusFilter === "all" || run.status === state.statusFilter;
    const categoryMatch =
      state.categoryFilter === "all" || run.category === state.categoryFilter;
    return statusMatch && categoryMatch;
  });
}

function setIndexMeta(indexPath) {
  elements.indexPath.textContent = indexPath || "—";
  elements.indexUpdated.textContent = formatDate(state.indexData?.generated_at);
  elements.indexRefreshed.textContent = formatDate(state.lastRefresh);
}

function setListState(message, type) {
  elements.listState.textContent = message;
  elements.listState.className = `state${type ? ` ${type}` : ""}`;
  elements.listState.style.display = "block";
}

function clearListState() {
  elements.listState.style.display = "none";
}

function setDetailState(message, type) {
  elements.detailState.textContent = message;
  elements.detailState.className = `state${type ? ` ${type}` : ""}`;
  elements.detailState.style.display = "block";
}

function clearDetailState() {
  elements.detailState.style.display = "none";
}

function canRefreshIndex() {
  return Boolean(state.indexPath && state.sourceType === "fetch");
}

function updateRefreshControls() {
  const canRefresh = canRefreshIndex();
  elements.refreshButton.disabled = !canRefresh || state.indexRefreshing;
  elements.autoRefresh.disabled = !canRefresh;
  elements.refreshInterval.disabled = !canRefresh;

  if (!canRefresh && state.refreshEnabled) {
    state.refreshEnabled = false;
    elements.autoRefresh.checked = false;
    updateRefreshTimer();
  }
}

function updateRefreshStatus() {
  let message = "Idle";
  let className = "muted refresh-status";

  if (!canRefreshIndex()) {
    message = "Load an HTTP index to enable refresh.";
  } else if (state.indexRefreshing) {
    message = "Refreshing...";
    className += " loading";
  } else if (state.refreshError) {
    message = `Refresh failed: ${state.refreshError}`;
    className += " error";
  } else if (state.refreshEnabled) {
    message = `Auto every ${formatInterval(state.refreshIntervalMs)}`;
  }

  elements.refreshStatus.textContent = message;
  elements.refreshStatus.className = className;
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

function renderFilters() {
  const runs = getRuns();
  const statusOptions = buildFilterOptions(runs, "status", STATUS_ORDER);
  const categoryOptions = buildFilterOptions(runs, "category");

  populateSelect(elements.statusFilter, statusOptions, (option) =>
    option === "all" ? "All statuses" : STATUS_LABELS[option] || option
  );
  populateSelect(elements.categoryFilter, categoryOptions, (option) =>
    option === "all" ? "All categories" : option
  );

  if (!statusOptions.includes(state.statusFilter)) {
    state.statusFilter = "all";
    elements.statusFilter.value = "all";
  }

  if (!categoryOptions.includes(state.categoryFilter)) {
    state.categoryFilter = "all";
    elements.categoryFilter.value = "all";
  }
}

function renderRunList() {
  const runs = getFilteredRuns();
  elements.runList.innerHTML = "";
  elements.runCount.textContent = `${runs.length} total`;

  if (state.indexLoading) {
    setListState("Loading experiment index…");
    return;
  }

  if (state.indexError) {
    setListState(`Unable to load index: ${state.indexError}`, "error");
    return;
  }

  if (!state.indexData) {
    setListState("Load an index to get started.");
    return;
  }

  if (runs.length === 0) {
    setListState("No runs match the current filters.", "empty");
    renderBestGrid();
    return;
  }

  clearListState();

  runs.forEach((run, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "run-card";
    if (run.run_id === state.selectedRunId) {
      card.classList.add("active");
    }
    card.style.animationDelay = `${index * 0.05}s`;
    card.addEventListener("click", () => selectRun(run.run_id));

    const top = document.createElement("div");
    top.className = "run-card-top";

    const titleBlock = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = run.display_name || run.run_id;
    const subtitle = document.createElement("p");
    subtitle.className = "muted";
    subtitle.textContent = run.run_id;
    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);

    const status = document.createElement("span");
    status.className = `status-badge status-${run.status || "planned"}`;
    status.textContent = STATUS_LABELS[run.status] || run.status || "planned";

    top.appendChild(titleBlock);
    top.appendChild(status);

    const meta = document.createElement("div");
    meta.className = "run-card-meta";

    meta.appendChild(createMetaField("Category", run.category || "—"));
    meta.appendChild(
      createMetaField("Accuracy", formatNumber(run.metrics?.accuracy))
    );
    const summary = getCachedSummary(run.run_id);
    meta.appendChild(createMetaField("Progress", formatProgress(summary)));
    meta.appendChild(
      createMetaField(
        "Updated",
        summary?.updated_at ? formatDate(summary.updated_at) : "—"
      )
    );
    const windowValue = run.dataset?.window
      ? `${run.dataset.window.start} to ${run.dataset.window.end}`
      : run.dataset?.label || "—";
    meta.appendChild(createMetaField("Window", windowValue));

    card.appendChild(top);
    card.appendChild(meta);
    elements.runList.appendChild(card);
  });

  renderBestGrid();
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

function renderBestGrid() {
  const runs = getRuns();
  const bestRuns = getBestRunsByCategory(runs);
  const runCounts = getRunCountsByCategory(runs);
  elements.bestGrid.innerHTML = "";
  elements.bestCount.textContent = `${bestRuns.length} categories`;

  if (!state.indexData) {
    elements.bestGrid.innerHTML = "<p class=\"best-empty\">Load data to see best runs.</p>";
    return;
  }

  if (bestRuns.length === 0) {
    elements.bestGrid.innerHTML =
      "<p class=\"best-empty\">No completed runs with metrics yet.</p>";
    return;
  }

  bestRuns.forEach(({ category, run }) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "best-card";
    card.addEventListener("click", () => focusOnRun(run));

    const title = document.createElement("h3");
    title.textContent = category;

    const name = document.createElement("p");
    name.className = "muted";
    name.textContent = run.display_name || run.run_id;

    const count = document.createElement("p");
    count.className = "muted";
    count.textContent = `${runCounts.get(category) || 0} runs`;

    const metrics = document.createElement("div");
    metrics.className = "best-metrics";
    metrics.appendChild(
      createMetaField("Accuracy", formatNumber(getRunAccuracy(run)))
    );
    metrics.appendChild(
      createMetaField("Loss", formatNumber(getRunLoss(run)))
    );

    card.appendChild(title);
    card.appendChild(name);
    card.appendChild(count);
    card.appendChild(metrics);

    elements.bestGrid.appendChild(card);
  });
}

function focusOnRun(run) {
  const categoryValue = run.category || "all";
  state.statusFilter = "all";
  state.categoryFilter = categoryValue;

  renderFilters();
  selectRun(run.run_id);
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
  title.textContent = selectedRun.display_name || selectedRun.run_id;
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = selectedRun.run_id;
  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  header.appendChild(titleBlock);

  if (selectedRun.category) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = selectedRun.category;
    header.appendChild(chip);
  }

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
  const progressValue = summary?.progress
    ? `${summary.progress.epoch}/${summary.progress.epochs}`
    : "—";
  detailGrid.appendChild(createMetaField("Progress", progressValue));
  detailGrid.appendChild(
    createMetaField("Dataset", formatDatasetValue(summary, selectedRun.run_id))
  );

  const metrics = document.createElement("div");
  metrics.className = "metrics";
  metrics.appendChild(
    createMetaField("Accuracy", formatNumber(summary?.metrics?.accuracy))
  );
  metrics.appendChild(
    createMetaField("Loss", formatNumber(summary?.metrics?.loss))
  );
  if (summary?.metrics?.best_val_loss !== undefined) {
    metrics.appendChild(
      createMetaField("Best val loss", formatNumber(summary?.metrics?.best_val_loss))
    );
  }

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

  const manifestPath = summary?.dataset?.manifest_path;
  let manifestBlock = null;
  if (manifestPath) {
    manifestBlock = document.createElement("div");
    manifestBlock.className = "links";
    const manifestTitle = document.createElement("h4");
    manifestTitle.textContent = "Dataset manifest";
    manifestBlock.appendChild(manifestTitle);
    manifestBlock.appendChild(createArtifactLink(manifestPath, manifestPath, summaryEntry));
  }

  elements.detailBody.appendChild(header);
  elements.detailBody.appendChild(description);
  elements.detailBody.appendChild(detailGrid);
  elements.detailBody.appendChild(metrics);
  elements.detailBody.appendChild(artifacts);
  if (manifestBlock) {
    elements.detailBody.appendChild(manifestBlock);
  }
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

function selectRun(runId) {
  state.selectedRunId = runId;
  renderRunList();

  const runs = getFilteredRuns();
  const selectedRun = runs.find((run) => run.run_id === runId);
  if (selectedRun) {
    loadSummary(selectedRun);
  }
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
    const summaryUrl = new URL(run.summary_path, state.indexUrl).toString();
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
  state.indexLoading = true;
  state.indexError = null;
  state.indexData = null;
  state.summaryCache.clear();
  state.selectedRunId = null;
  state.refreshError = null;
  renderRunList();
  renderDetail();

  try {
    const result = await fetchIndexData(path);
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
    setIndexMeta(null);
  } finally {
    state.indexLoading = false;
    renderFilters();
    syncSelection();
    renderRunList();
    if (state.selectedRunId) {
      const run = getFilteredRuns().find((item) => item.run_id === state.selectedRunId);
      if (run) {
        loadSummary(run);
      }
    }
    updateRefreshControls();
    updateRefreshStatus();
    updateRefreshTimer();
    if (state.indexData) {
      prefetchSummaries(getRuns().filter((run) => run.status === "running"));
    }
  }
}

async function loadLegacyFile(file) {
  state.indexLoading = true;
  state.indexError = null;
  state.indexData = null;
  state.summaryCache.clear();
  state.selectedRunId = null;
  state.refreshError = null;
  renderRunList();
  renderDetail();

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) {
      throw new Error("Expected summary.json array.");
    }

    const legacy = buildLegacyIndex(data, {
      summaryPath: file.name,
      summaryUrl: null
    });
    state.indexData = legacy.indexData;
    state.sourceType = "file";
    state.summaryInline = true;
    state.indexPath = file.name;
    state.indexUrl = null;
    state.lastRefresh = new Date().toISOString();
    legacy.summaries.forEach((entry) =>
      state.summaryCache.set(entry.run_id, entry)
    );
    setIndexMeta(file.name);
    updateQueryParam("");
    elements.indexInput.value = "";
  } catch (error) {
    state.indexError = error.message || "Unable to load summary.json file.";
    state.sourceType = null;
    state.summaryInline = false;
    state.indexPath = null;
    state.indexUrl = null;
    state.lastRefresh = null;
    setIndexMeta(null);
  } finally {
    state.indexLoading = false;
    renderFilters();
    syncSelection();
    renderRunList();
    if (state.selectedRunId) {
      const run = getFilteredRuns().find((item) => item.run_id === state.selectedRunId);
      if (run) {
        loadSummary(run);
      }
    }
    updateRefreshControls();
    updateRefreshStatus();
    updateRefreshTimer();
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

  renderRunList();
}

async function refreshIndex() {
  if (!canRefreshIndex() || state.indexRefreshing) {
    return;
  }

  state.indexRefreshing = true;
  state.refreshError = null;
  updateRefreshControls();
  updateRefreshStatus();

  try {
    const result = await fetchIndexData(state.indexPath);
    state.lastRefresh = new Date().toISOString();
    applyIndexResult(result, {
      preserveSelection: true,
      preserveFilters: true,
      updateUrl: false
    });

    renderFilters();
    syncSelection();
    renderRunList();

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
    updateRefreshControls();
    updateRefreshStatus();
  }
}

function attachEventHandlers() {
  elements.statusFilter.addEventListener("change", (event) => {
    state.statusFilter = event.target.value;
    syncSelection();
    renderRunList();
    renderDetail();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    state.categoryFilter = event.target.value;
    syncSelection();
    renderRunList();
    renderDetail();
  });

  elements.loadIndex.addEventListener("click", () => {
    const path = elements.indexInput.value.trim();
    if (path.length === 0) {
      return;
    }
    loadIndexFromFetch(path, true);
  });

  elements.loadLegacy.addEventListener("click", () => {
    elements.legacyFile.click();
  });

  elements.legacyFile.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    await loadLegacyFile(file);
    event.target.value = "";
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshIndex();
  });

  elements.autoRefresh.addEventListener("change", (event) => {
    state.refreshEnabled = event.target.checked;
    updateRefreshTimer();
    updateRefreshStatus();
  });

  elements.refreshInterval.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.refreshIntervalMs = Number.isNaN(value) ? 30000 : value;
    updateRefreshTimer();
    updateRefreshStatus();
  });
}

function init() {
  attachEventHandlers();
  renderFilters();
  renderRunList();
  renderDetail();
  state.refreshIntervalMs = Number(elements.refreshInterval.value) || 30000;
  elements.autoRefresh.checked = state.refreshEnabled;
  updateRefreshControls();
  updateRefreshStatus();

  const queryIndex = new URLSearchParams(window.location.search).get("index");
  if (queryIndex) {
    elements.indexInput.value = queryIndex;
    loadIndexFromFetch(queryIndex, false);
    return;
  }

  elements.indexInput.value = DEFAULT_INDEX_PATH;
  loadIndexFromFetch(DEFAULT_INDEX_PATH, false);
}

init();
