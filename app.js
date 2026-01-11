const STATUS_ORDER = ["planned", "running", "completed", "failed", "canceled"];
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
  indexUrl: null
};

const elements = {
  indexPath: document.getElementById("index-path"),
  indexUpdated: document.getElementById("index-updated"),
  statusFilter: document.getElementById("status-filter"),
  categoryFilter: document.getElementById("category-filter"),
  runCount: document.getElementById("run-count"),
  runList: document.getElementById("run-list"),
  listState: document.getElementById("list-state"),
  detailState: document.getElementById("detail-state"),
  detailBody: document.getElementById("detail-body"),
  detailStatus: document.getElementById("detail-status"),
  indexInput: document.getElementById("index-input"),
  loadIndex: document.getElementById("load-index"),
  loadLegacy: document.getElementById("load-legacy"),
  legacyFile: document.getElementById("legacy-file")
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
    const windowValue = run.dataset?.window
      ? `${run.dataset.window.start} to ${run.dataset.window.end}`
      : run.dataset?.label || "—";
    meta.appendChild(createMetaField("Window", windowValue));

    card.appendChild(top);
    card.appendChild(meta);
    elements.runList.appendChild(card);
  });
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

async function loadSummary(run) {
  if (state.summaryInline) {
    state.summaryLoading = false;
    state.summaryError = null;
    renderDetail();
    return;
  }

  if (!run?.summary_path) {
    state.summaryError = "Missing summary path for this run.";
    state.summaryLoading = false;
    renderDetail();
    return;
  }

  state.summaryLoading = true;
  state.summaryError = null;
  renderDetail();

  try {
    const summaryUrl = new URL(run.summary_path, state.indexUrl).toString();
    const response = await fetch(summaryUrl);
    if (!response.ok) {
      throw new Error(`Summary fetch failed (${response.status})`);
    }
    const data = await response.json();
    state.summaryCache.set(run.run_id, {
      data,
      summaryUrl
    });
  } catch (error) {
    state.summaryError = error.message || "Unable to load summary.";
  } finally {
    state.summaryLoading = false;
    renderDetail();
  }
}

async function loadIndexFromFetch(path, updateUrl) {
  state.indexLoading = true;
  state.indexError = null;
  state.indexData = null;
  state.summaryCache.clear();
  state.selectedRunId = null;
  renderRunList();
  renderDetail();

  try {
    const indexUrl = new URL(path, window.location.href).toString();
    const response = await fetch(indexUrl);
    if (!response.ok) {
      throw new Error(`Index fetch failed (${response.status})`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      const legacy = buildLegacyIndex(data, {
        summaryPath: path,
        summaryUrl: indexUrl
      });
      state.indexData = legacy.indexData;
      state.sourceType = "fetch";
      state.summaryInline = true;
      legacy.summaries.forEach((entry) =>
        state.summaryCache.set(entry.run_id, entry)
      );
      setIndexMeta(path);
    } else {
      state.indexData = data;
      state.sourceType = "fetch";
      state.summaryInline = false;
      state.indexUrl = indexUrl;
      setIndexMeta(path);
    }

    state.indexPath = path;
    if (updateUrl) {
      updateQueryParam(path);
    }
    elements.indexInput.value = path;
  } catch (error) {
    state.indexError = error.message || "Unable to load experiment index.";
    state.sourceType = null;
    state.summaryInline = false;
    state.indexPath = null;
    state.indexUrl = null;
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
  }
}

async function loadLegacyFile(file) {
  state.indexLoading = true;
  state.indexError = null;
  state.indexData = null;
  state.summaryCache.clear();
  state.selectedRunId = null;
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
}

function init() {
  attachEventHandlers();
  renderFilters();
  renderRunList();
  renderDetail();

  const queryIndex = new URLSearchParams(window.location.search).get("index");
  if (queryIndex) {
    elements.indexInput.value = queryIndex;
    loadIndexFromFetch(queryIndex, false);
    return;
  }

  setIndexMeta(null);
}

init();
