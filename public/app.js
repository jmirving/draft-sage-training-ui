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
  "pb-role-weights-matrix": "Pick/Ban priors + role distribution",
  "role-priors": "Role distribution priors",
  "priors-role-priors": "Pick/Ban priors + role distribution",
  "league-team-priors": "League/team priors",
  "timeaware-priors": "Time-aware priors"
};
// Curated list of intentional experiment knobs to show in UI diff/compare views.
const CONFIG_DIFF_REGISTRY = [
  {
    key: "dataset_label",
    label: "Dataset",
    group: "Data + Training",
    help: "Human-readable dataset name attached to the run."
  },
  {
    key: "split_strategy",
    label: "Split strategy",
    group: "Data + Training",
    help: "How matches are split across train/val/test (for example, seriesid)."
  },
  {
    key: "patch_window",
    label: "Patch window",
    group: "Data + Training",
    help: "Optional patch recency window applied before training."
  },
  {
    key: "patches",
    label: "Patch filter",
    group: "Data + Training",
    format: "list",
    help: "Explicit patch versions included in this run."
  },
  {
    key: "train_split",
    label: "Train split ratio",
    group: "Data + Training",
    help: "Fraction of examples allocated to training."
  },
  {
    key: "val_split",
    label: "Validation split ratio",
    group: "Data + Training",
    help: "Fraction of examples allocated to validation."
  },
  {
    key: "test_split",
    label: "Test split ratio",
    group: "Data + Training",
    help: "Fraction of examples allocated to holdout testing."
  },
  {
    key: "batch_size",
    label: "Batch size",
    group: "Data + Training",
    help: "Training batch size."
  },
  {
    key: "epochs",
    label: "Epoch count",
    group: "Data + Training",
    help: "Maximum full passes over the training set."
  },
  {
    key: "learning_rate",
    label: "Learning rate",
    group: "Data + Training",
    help: "Optimizer learning rate."
  },
  {
    key: "seed",
    label: "Random seed",
    group: "Data + Training",
    help: "Random seed used for reproducibility."
  },
  {
    key: "champion_eligibility_path",
    label: "Champion eligibility mask",
    group: "Draft Priors",
    format: "presence_bool",
    help: "Whether an eligibility artifact is applied to mask unavailable champions."
  },
  {
    key: "champion_priors_dir",
    label: "Champion P/B priors source",
    group: "Draft Priors",
    format: "presence_bool",
    help: "Whether champion pick/ban priors are loaded. P/B priors bias predictions toward champions historically picked or banned in similar contexts."
  },
  {
    key: "role_priors_dir",
    label: "Champion Role Distribution source",
    group: "Draft Priors",
    format: "presence_bool",
    help: "Whether champion role distribution priors are loaded. Role distribution priors bias picks toward champions that fit missing team roles."
  },
  {
    key: "champion_priors_strength",
    label: "Champion P/B priors weight",
    group: "Draft Priors",
    help: "Scalar weight applied to champion pick/ban priors. Higher values increase the influence of historical pick/ban tendencies."
  },
  {
    key: "role_priors_strength",
    label: "Champion Role Distribution weight",
    group: "Draft Priors",
    help: "Scalar weight applied to role distribution priors. Higher values increase pressure toward role-balanced drafts."
  },
  {
    key: "team_league_priors_strength",
    label: "Team/league priors weight",
    group: "Draft Priors",
    help: "Scalar weight for team and league priors."
  },
  {
    key: "series_priors_strength",
    label: "Series priors weight",
    group: "Draft Priors",
    help: "Scalar weight for series-level priors."
  },
  {
    key: "use_league_embeddings",
    inverseKey: "no_league_embeddings",
    label: "League embeddings",
    group: "Embeddings",
    format: "bool",
    help: "Whether learned league embeddings are enabled. League embeddings help the model capture league-level drafting patterns and meta differences."
  },
  {
    key: "use_team_embeddings",
    inverseKey: "no_team_embeddings",
    label: "Team embeddings",
    group: "Embeddings",
    format: "bool",
    help: "Whether learned team embeddings are enabled. Team embeddings help the model capture persistent team-specific draft preferences."
  },
  {
    key: "inspection_keep",
    label: "Inspection sample size",
    group: "Reporting",
    help: "Number of inspection samples retained for artifact review."
  }
];
const VARIANT_TOKEN_LABELS = {
  dataset_label: "Dataset",
  split_strategy: "Split",
  patch_window: "Patch window",
  patches: "Patch filter",
  train_split: "Train split",
  val_split: "Val split",
  test_split: "Test split",
  batch_size: "Batch",
  epochs: "Epochs",
  learning_rate: "LR",
  seed: "Seed",
  champion_eligibility_path: "Eligibility",
  champion_priors_dir: "PB priors src",
  role_priors_dir: "Role dist src",
  champion_priors_strength: "PB priors wt",
  role_priors_strength: "Role dist wt",
  team_league_priors_strength: "Team/league wt",
  series_priors_strength: "Series priors wt",
  use_league_embeddings: "League emb",
  use_team_embeddings: "Team emb",
  inspection_keep: "Inspection keep"
};
const MAX_COMPARE_RUNS = 6;
const GROUP_BASELINE_STORAGE_KEY = "draftsage.groupBaselines.v1";

const state = {
  indexData: null,
  indexLoading: false,
  indexError: null,
  summaryCache: new Map(),
  summaryBackgroundLoading: new Set(),
  summaryBackgroundError: new Map(),
  summaryLoading: false,
  summaryError: null,
  summaryInline: false,
  configCache: new Map(),
  configLoading: new Set(),
  configError: new Map(),
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
  compareRunIds: [],
  compareWorkspaceVisible: false,
  groupBaselineRunIds: new Map(),
  expandedGroupKeys: new Set(),
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
  groupSpread: document.getElementById("group-spread"),
  comparisonBody: document.getElementById("comparison-body"),
  comparisonHeaders: Array.from(
    document.querySelectorAll("#comparison-table thead th[data-sort]")
  ),
  compareCount: document.getElementById("compare-count"),
  compareWorkspace: document.getElementById("compare-workspace"),
  compareWorkspaceToggle: document.getElementById("compare-workspace-toggle"),
  compareState: document.getElementById("compare-state"),
  compareRunPicker: document.getElementById("compare-run-picker"),
  compareAddPicker: document.getElementById("compare-add-picker"),
  compareAddSelected: document.getElementById("compare-add-selected"),
  compareClear: document.getElementById("compare-clear"),
  compareSelected: document.getElementById("compare-selected"),
  compareMatrix: document.getElementById("compare-matrix"),
  compareKnobHead: document.getElementById("compare-knob-head"),
  compareKnobBody: document.getElementById("compare-knob-body"),
  detailState: document.getElementById("detail-state"),
  detailBody: document.getElementById("detail-body"),
  detailStatus: document.getElementById("detail-status")
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

function formatInteger(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }
  return Math.floor(value).toLocaleString();
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
        canonicalTeam:
          typeof row?.canonical?.team === "string"
            ? row.canonical.team.toLowerCase()
            : null,
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
  const team = row?.canonicalTeam;
  const type = row?.canonicalType;
  const num = row?.canonicalNum;
  if (!team && !type && !num) {
    return `Slot ${row?.slot ?? "?"}`;
  }
  const teamLabel =
    team === "team_1" ? "Team 1" : team === "team_2" ? "Team 2" : "Team ?";
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

function compactPath(value, maxLength = 62) {
  const text = String(value || "");
  if (!text) {
    return "—";
  }
  if (text.length <= maxLength) {
    return text;
  }
  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  return `${text.slice(0, keep)}...${text.slice(-keep)}`;
}

function formatConfigValue(value, format) {
  if (format === "presence_bool") {
    return value ? "On" : "Off";
  }
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (format === "bool") {
    return value ? "On" : "Off";
  }
  if (format === "list") {
    if (!Array.isArray(value)) {
      return String(value);
    }
    return value.length > 0 ? value.join(", ") : "—";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "—";
    }
    if (Number.isInteger(value)) {
      return String(value);
    }
    if (Math.abs(value) < 0.01) {
      return value.toFixed(5);
    }
    if (Math.abs(value) < 1) {
      return value.toFixed(4);
    }
    return value.toFixed(3);
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function readConfigKey(config, spec) {
  if (!config || typeof config !== "object" || !spec) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(config, spec.key)) {
    return config[spec.key];
  }
  if (spec.inverseKey && Object.prototype.hasOwnProperty.call(config, spec.inverseKey)) {
    return !Boolean(config[spec.inverseKey]);
  }
  return undefined;
}

function buildConfigHelpText(spec) {
  if (!spec?.key) {
    return "";
  }
  const description = spec.help || "Tracked configuration knob used in comparisons.";
  return description;
}

function serializeConfigValue(value) {
  if (value === undefined) {
    return "__undefined__";
  }
  if (value === null) {
    return "__null__";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "__nan__";
    }
    return `number:${value}`;
  }
  if (typeof value === "boolean") {
    return `bool:${value}`;
  }
  if (typeof value === "string") {
    return `string:${value}`;
  }
  if (Array.isArray(value)) {
    return `array:${JSON.stringify(value)}`;
  }
  if (typeof value === "object") {
    const ordered = Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {});
    return `object:${JSON.stringify(ordered)}`;
  }
  return String(value);
}

function configValuesEqual(left, right) {
  return serializeConfigValue(left) === serializeConfigValue(right);
}

function loadGroupBaselineOverrides() {
  try {
    const raw = window.localStorage.getItem(GROUP_BASELINE_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }
    Object.entries(parsed).forEach(([groupKey, runId]) => {
      if (groupKey && typeof runId === "string" && runId.length > 0) {
        state.groupBaselineRunIds.set(groupKey, runId);
      }
    });
  } catch (_error) {
    // Ignore malformed local storage and continue with default behavior.
  }
}

function persistGroupBaselineOverrides() {
  try {
    const payload = Object.fromEntries(state.groupBaselineRunIds.entries());
    window.localStorage.setItem(GROUP_BASELINE_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore local storage write failures.
  }
}

function sortConfigRows(rows) {
  return [...rows].sort((a, b) => {
    const groupCompare = (a.group || "").localeCompare(b.group || "");
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return (a.label || "").localeCompare(b.label || "");
  });
}

function ensureSummaryEntry(run) {
  if (!run?.run_id) {
    return null;
  }
  const cached = state.summaryCache.get(run.run_id);
  if (cached) {
    return cached;
  }
  if (
    !state.summaryInline &&
    run.summary_path &&
    !state.summaryBackgroundLoading.has(run.run_id)
  ) {
    state.summaryBackgroundLoading.add(run.run_id);
    state.summaryBackgroundError.delete(run.run_id);
    fetchSummary(run, {
      silent: true
    }).finally(() => {
      state.summaryBackgroundLoading.delete(run.run_id);
      renderAll();
    });
  }
  return null;
}

function buildConfigDiffRows(selectedConfig, baselineConfig) {
  const rows = [];

  CONFIG_DIFF_REGISTRY.forEach((spec) => {
    const selectedValue = readConfigKey(selectedConfig, spec);
    const baselineValue = readConfigKey(baselineConfig, spec);
    if (selectedValue === undefined && baselineValue === undefined) {
      return;
    }
    rows.push({
      key: spec.key,
      label: spec.label,
      group: spec.group || "Other",
      helpText: buildConfigHelpText(spec),
      selectedValue,
      baselineValue,
      changed: !configValuesEqual(selectedValue, baselineValue),
      format: spec.format || null,
      isUnknown: false
    });
  });

  const allRows = sortConfigRows(rows);
  const changedRows = allRows.filter((row) => row.changed);

  return {
    allRows,
    changedRows,
    unchangedCount: allRows.length - changedRows.length
  };
}

function createConfigDiffRow(row, options = {}) {
  const { selectedLabel = "Selected", baselineLabel = "Baseline", includeBaseline = true } =
    options;
  const item = document.createElement("div");
  item.className = "config-diff-row";
  if (row.isUnknown) {
    item.classList.add("unknown");
  }
  if (!includeBaseline) {
    item.classList.add("single-value");
  }

  const label = document.createElement("span");
  label.className = "config-diff-label";
  label.textContent = row.label;
  if (row.helpText) {
    label.title = row.helpText;
  }

  const selected = document.createElement("span");
  selected.className = "config-diff-value selected";
  selected.textContent = `${selectedLabel}: ${formatConfigValue(row.selectedValue, row.format)}`;

  item.appendChild(label);
  item.appendChild(selected);
  if (includeBaseline) {
    const baseline = document.createElement("span");
    baseline.className = "config-diff-value baseline";
    baseline.textContent = `${baselineLabel}: ${formatConfigValue(row.baselineValue, row.format)}`;
    item.appendChild(baseline);
  }
  return item;
}

function appendGroupedConfigRows(body, rows, renderRow) {
  const groupedRows = new Map();
  rows.forEach((row) => {
    const group = row.group || "Other";
    if (!groupedRows.has(group)) {
      groupedRows.set(group, []);
    }
    groupedRows.get(group).push(row);
  });

  Array.from(groupedRows.keys())
    .sort((left, right) => left.localeCompare(right))
    .forEach((group) => {
      const groupBlock = document.createElement("div");
      groupBlock.className = "config-diff-group";
      const groupTitle = document.createElement("h5");
      groupTitle.textContent = group;
      groupBlock.appendChild(groupTitle);

      const list = document.createElement("div");
      list.className = "config-diff-list";
      groupedRows.get(group).forEach((row) => {
        list.appendChild(renderRow(row));
      });
      groupBlock.appendChild(list);
      body.appendChild(groupBlock);
    });
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

function humanizeIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "—";
  }
  const withoutPrefix = text.replace(/^exp[-_]/i, "");
  const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return text;
  }
  return titleCase(normalized);
}

function getGroupLabelByKey(key) {
  if (!key) {
    return "Uncategorized";
  }
  return state.groupLabels.get(key) || GROUP_LABELS[key] || humanizeIdentifier(key);
}

function getGroupLabel(run) {
  return getGroupLabelByKey(getGroupKey(run));
}

function getVariantRawLabel(run) {
  return run?.variant_label || run?.display_name || run?.run_id || "—";
}

function getVariantLabel(run) {
  const raw = getVariantRawLabel(run);
  if (!raw || raw === "—") {
    return "—";
  }
  const humanized = humanizeIdentifier(raw);
  const groupLabel = getGroupLabel(run).toLowerCase();
  const groupHumanized = humanizeIdentifier(getGroupKey(run)).toLowerCase();

  const variants = [groupLabel, groupHumanized].filter(Boolean);
  let cleaned = humanized;
  variants.forEach((prefix) => {
    const lower = cleaned.toLowerCase();
    if (!prefix || lower === prefix) {
      return;
    }
    const matchPrefix = `${prefix} `;
    if (lower.startsWith(matchPrefix)) {
      cleaned = cleaned.slice(matchPrefix.length).trim();
    }
  });
  return cleaned || humanized;
}

function getGroupReferenceRun(groupKey, runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }
  const selectedBaselineRunId = groupKey ? state.groupBaselineRunIds.get(groupKey) : null;
  if (selectedBaselineRunId) {
    const selectedRun = runs.find((run) => run?.run_id === selectedBaselineRunId);
    if (selectedRun) {
      return selectedRun;
    }
    state.groupBaselineRunIds.delete(groupKey);
    persistGroupBaselineOverrides();
  }
  return runs
    .map((run, index) => ({
      run,
      index,
      ts: getRunSortTimestamp(run, index)
    }))
    .sort((left, right) => {
      if (left.ts === right.ts) {
        return left.index - right.index;
      }
      return left.ts - right.ts;
    })[0]?.run || runs[0];
}

function getVariantTokenLabel(spec) {
  if (!spec?.key) {
    return "Knob";
  }
  return VARIANT_TOKEN_LABELS[spec.key] || spec.label || titleCase(spec.key);
}

function getRunConfig(run, loadIfMissing = false) {
  if (!run?.run_id) {
    return null;
  }
  const cached = state.configCache.get(run.run_id);
  if (cached?.data) {
    return cached.data;
  }
  if (!loadIfMissing) {
    return null;
  }
  const summaryEntry = ensureSummaryEntry(run);
  const configPath = summaryEntry?.data?.paths?.config;
  if (!summaryEntry || !configPath) {
    return null;
  }
  const configState = resolveConfigState(run.run_id, summaryEntry, configPath);
  if (configState.status === "ready") {
    return configState.data;
  }
  return null;
}

function getRunVariantDeltaLabel(run, options = {}) {
  if (!run) {
    return "—";
  }
  const {
    groupRuns = null,
    referenceRun: explicitReferenceRun = null,
    runConfig = null,
    referenceConfig = null,
    loadIfMissing = false
  } = options;
  const resolvedGroupRuns =
    Array.isArray(groupRuns) && groupRuns.length > 0
      ? groupRuns
      : getRuns().filter((candidate) => getGroupKey(candidate) === getGroupKey(run));
  const resolvedReferenceRun =
    explicitReferenceRun || getGroupReferenceRun(getGroupKey(run), resolvedGroupRuns);
  const resolvedRunConfig = runConfig || getRunConfig(run, loadIfMissing);
  const resolvedReferenceConfig =
    referenceConfig || getRunConfig(resolvedReferenceRun, loadIfMissing);
  return getConfigDerivedVariantLabel(
    resolvedGroupRuns,
    run,
    resolvedReferenceRun,
    resolvedRunConfig,
    resolvedReferenceConfig
  );
}

function getConfigDerivedVariantLabel(groupRuns, run, referenceRun, runConfig, referenceConfig) {
  if (!run) {
    return "—";
  }
  if (!Array.isArray(groupRuns) || groupRuns.length <= 1) {
    return "Only run";
  }
  if (!referenceRun || !runConfig || !referenceConfig) {
    return getVariantLabel(run);
  }

  const tokens = [];
  CONFIG_DIFF_REGISTRY.forEach((spec) => {
    const runValue = readConfigKey(runConfig, spec);
    const referenceValue = readConfigKey(referenceConfig, spec);
    if (runValue === undefined && referenceValue === undefined) {
      return;
    }
    if (configValuesEqual(runValue, referenceValue)) {
      return;
    }
    tokens.push(`${getVariantTokenLabel(spec)}=${formatConfigValue(runValue, spec.format)}`);
  });

  if (tokens.length === 0) {
    if (run.run_id === referenceRun.run_id) {
      return "Group baseline";
    }
    return "Matches group baseline";
  }

  const visibleTokenCount = 3;
  if (tokens.length <= visibleTokenCount) {
    return tokens.join(" · ");
  }
  const overflow = tokens.length - visibleTokenCount;
  return `${tokens.slice(0, visibleTokenCount).join(" · ")} +${overflow} more`;
}

function summarizeKnobTokens(tokens, visibleTokenCount = 3) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return "";
  }
  if (tokens.length <= visibleTokenCount) {
    return tokens.join(" · ");
  }
  const overflow = tokens.length - visibleTokenCount;
  return `${tokens.slice(0, visibleTokenCount).join(" · ")} +${overflow} more`;
}

function getRunKnobSignature(run, baselineRun, baselineConfig, options = {}) {
  const {
    runConfig = null,
    loadIfMissing = false,
    visibleTokenCount = 3
  } = options;

  if (!run?.run_id) {
    return {
      status: "missing",
      changedCount: 0,
      text: "—"
    };
  }
  if (!baselineRun) {
    return {
      status: "no-baseline",
      changedCount: 0,
      text: "Baseline not set"
    };
  }
  if (!baselineConfig) {
    return {
      status: "baseline-loading",
      changedCount: 0,
      text: "Baseline config loading…"
    };
  }

  const selectedConfig = runConfig || getRunConfig(run, loadIfMissing);
  if (!selectedConfig) {
    return {
      status: "run-loading",
      changedCount: 0,
      text: "Config loading…"
    };
  }

  const diff = buildConfigDiffRows(selectedConfig, baselineConfig);
  const changedRows = diff.changedRows || [];
  if (changedRows.length === 0) {
    if (run.run_id === baselineRun.run_id) {
      return {
        status: "baseline",
        changedCount: 0,
        text: "Baseline reference"
      };
    }
    return {
      status: "matching",
      changedCount: 0,
      text: "Matches baseline"
    };
  }

  const tokens = changedRows.map((row) => {
    const tokenLabel = getVariantTokenLabel({ key: row.key, label: row.label });
    const tokenValue = formatConfigValue(row.selectedValue, row.format);
    return `${tokenLabel}=${tokenValue}`;
  });

  return {
    status: "changed",
    changedCount: changedRows.length,
    text: summarizeKnobTokens(tokens, visibleTokenCount)
  };
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

function buildComparisonRows(runs) {
  const baselineToBeat = getBaselineToBeatRun();
  const baselineMetric = baselineToBeat ? getMetricValue(baselineToBeat) : null;
  return Array.from(buildGroupStats(runs).values()).map((group, index) => {
    const referenceRun = getGroupReferenceRun(group.key, group.runs);
    const referenceConfig = getRunConfig(referenceRun, true);
    const bestConfig = getRunConfig(group.best, true);
    const metricSamples = group.runs
      .map((run) => getMetricValue(run))
      .filter((value) => typeof value === "number" && !Number.isNaN(value));
    const metricMin = metricSamples.length > 0 ? Math.min(...metricSamples) : null;
    const metricMax = metricSamples.length > 0 ? Math.max(...metricSamples) : null;
    const metricSpread =
      metricMin !== null && metricMax !== null ? metricMax - metricMin : null;
    const metricValue = group.best ? getMetricValue(group.best) : null;
    const delta = computeDelta(metricValue, baselineMetric);
    const updatedRaw = getRunUpdatedAt(group.best);
    const updatedTs = updatedRaw ? new Date(updatedRaw).getTime() : Number.NEGATIVE_INFINITY;

    return {
      ...group,
      runCount: group.runs.length,
      metricValue,
      delta,
      updatedRaw,
      updatedTs: Number.isNaN(updatedTs) ? Number.NEGATIVE_INFINITY : updatedTs,
      statusLabel: STATUS_LABELS[group.best?.status] || group.best?.status || "—",
      referenceRun,
      bestVariantLabel: getConfigDerivedVariantLabel(
        group.runs,
        group.best,
        referenceRun,
        bestConfig,
        referenceConfig
      ),
      metricMin,
      metricMax,
      metricSpread,
      index
    };
  });
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
  const runningCard = elements.runningNow.closest(".decision-card");
  if (runningCard) {
    runningCard.classList.toggle("is-empty", running.length === 0);
  }
  if (running.length === 0) {
    elements.runningNow.innerHTML =
      '<div class="decision-item decision-item-inline"><span class="decision-title">Queue clear</span></div>';
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
    title.title = getVariantRawLabel(bestChallenger);

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
  title.textContent = getVariantLabel(run);
  title.title = getVariantRawLabel(run);

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
  const groupCount = new Set(runs.map(getGroupKey)).size;
  elements.tableCount.textContent = `${groupCount} groups · ${runs.length} runs`;
  renderGroupSpread([]);

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

  const columnCount = 8;
  const groups = buildComparisonRows(runs);
  if (state.groupFilter !== "all" && groups.length === 1) {
    state.expandedGroupKeys.add(groups[0].key);
  }
  renderGroupSpread(groups);
  groups.sort(compareComparisonRows);

  groups.forEach((group) => {
    const row = document.createElement("tr");
    row.classList.toggle("expanded", state.expandedGroupKeys.has(group.key));
    if (group.best?.run_id === state.selectedRunId) {
      row.classList.add("active");
    }
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      const runId = group.best?.run_id;
      if (!runId) {
        return;
      }
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        addCompareRun(runId);
      }
      if (state.expandedGroupKeys.has(group.key)) {
        if (state.selectedRunId === runId) {
          state.expandedGroupKeys.delete(group.key);
        }
      } else {
        state.expandedGroupKeys.add(group.key);
      }
      selectRun(runId);
    });
    const deltaClass =
      group.delta === null
        ? "neutral"
        : group.delta > 0
          ? "positive"
          : group.delta < 0
            ? "negative"
            : "neutral";

    const groupCell = document.createElement("td");
    groupCell.className = "group-cell";
    const groupName = document.createElement("span");
    groupName.className = "group-cell-name";
    groupName.textContent = group.label;
    const groupMeta = document.createElement("span");
    groupMeta.className = "group-cell-meta";
    groupMeta.textContent = `${group.runCount} runs`;
    groupCell.appendChild(groupName);
    groupCell.appendChild(groupMeta);
    row.appendChild(groupCell);

    row.appendChild(createCell(String(group.runCount)));
    const bestVariantPrimary = group.best
      ? group.bestVariantLabel || getVariantLabel(group.best)
      : "—";
    const bestVariantSecondary =
      group.best && bestVariantPrimary !== getVariantLabel(group.best)
        ? getVariantLabel(group.best)
        : "";
    row.appendChild(
      createPrimarySecondaryCell(
        bestVariantPrimary,
        bestVariantSecondary
      )
    );
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
    const detailsCell = document.createElement("td");
    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "group-detail-toggle";
    const expanded = state.expandedGroupKeys.has(group.key);
    detailsButton.textContent = expanded ? "Hide runs" : "View runs";
    detailsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.expandedGroupKeys.has(group.key)) {
        state.expandedGroupKeys.delete(group.key);
      } else {
        state.expandedGroupKeys.add(group.key);
      }
      renderComparisonTable();
    });
    detailsCell.appendChild(detailsButton);
    row.appendChild(detailsCell);

    elements.comparisonBody.appendChild(row);
    if (expanded) {
      elements.comparisonBody.appendChild(renderGroupDetailsRow(group, columnCount));
    }
  });
}

function renderGroupSpread(groups) {
  if (!elements.groupSpread) {
    return;
  }
  elements.groupSpread.innerHTML = "";

  const rows = Array.isArray(groups)
    ? groups.filter(
        (group) =>
          typeof group.metricMin === "number" &&
          !Number.isNaN(group.metricMin) &&
          typeof group.metricMax === "number" &&
          !Number.isNaN(group.metricMax)
      )
    : [];

  if (rows.length === 0) {
    elements.groupSpread.style.display = "none";
    return;
  }

  const sortedRows = rows
    .slice()
    .sort((left, right) => compareNullableNumbers(left.metricValue, right.metricValue, "desc"));
  const displayRows = sortedRows.slice(0, 8);

  const domainMin = Math.min(...displayRows.map((group) => group.metricMin));
  const domainMax = Math.max(...displayRows.map((group) => group.metricMax));
  const domainSpan = Math.max(domainMax - domainMin, 1e-9);

  const header = document.createElement("p");
  header.className = "group-spread-title";
  header.textContent = "Group performance spread (best to worst)";
  elements.groupSpread.appendChild(header);

  displayRows.forEach((group) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "group-spread-row";
    if (group.best?.run_id === state.selectedRunId) {
      row.classList.add("active");
    }
    row.addEventListener("click", () => {
      state.groupFilter = group.key;
      elements.groupFilter.value = group.key;
      state.expandedGroupKeys.add(group.key);
      if (group.best?.run_id) {
        selectRun(group.best.run_id);
      } else {
        syncSelection();
        renderAll();
      }
    });

    const label = document.createElement("span");
    label.className = "group-spread-label";
    label.textContent = `${group.label} (${group.runCount})`;
    row.appendChild(label);

    const track = document.createElement("span");
    track.className = "group-spread-track";

    const range = document.createElement("span");
    range.className = "group-spread-range";
    const startPct = ((group.metricMin - domainMin) / domainSpan) * 100;
    const widthPct = ((group.metricMax - group.metricMin) / domainSpan) * 100;
    const clampedStart = Math.max(0, Math.min(98, startPct));
    const clampedWidth = Math.max(2, Math.min(widthPct, 100 - clampedStart));
    range.style.left = `${clampedStart}%`;
    range.style.width = `${clampedWidth}%`;
    track.appendChild(range);

    const best = document.createElement("span");
    best.className = "group-spread-best";
    const bestMetric =
      typeof group.metricValue === "number" && !Number.isNaN(group.metricValue)
        ? group.metricValue
        : group.metricMax;
    const bestPct = ((bestMetric - domainMin) / domainSpan) * 100;
    best.style.left = `${Math.max(0, Math.min(100, bestPct))}%`;
    track.appendChild(best);
    row.appendChild(track);

    const value = document.createElement("span");
    value.className = "group-spread-value";
    value.textContent = formatNumber(group.metricValue);
    row.appendChild(value);

    elements.groupSpread.appendChild(row);
  });

  if (sortedRows.length > displayRows.length) {
    const footer = document.createElement("p");
    footer.className = "group-spread-footnote";
    footer.textContent = `Showing top ${displayRows.length} of ${sortedRows.length} groups.`;
    elements.groupSpread.appendChild(footer);
  }

  elements.groupSpread.style.display = "grid";
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
        a.bestVariantLabel || "",
        b.bestVariantLabel || ""
      );
      break;
    case "runs":
      base = compareNullableNumbers(a.runCount, b.runCount, direction);
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

function renderGroupDetailsRow(group, columnCount) {
  const detailRow = document.createElement("tr");
  detailRow.className = "group-details-row";

  const detailCell = document.createElement("td");
  detailCell.className = "group-details-cell";
  detailCell.colSpan = columnCount;

  const wrap = document.createElement("div");
  wrap.className = "group-details-wrap";

  const title = document.createElement("p");
  title.className = "group-details-title";
  title.textContent = `${group.label}: ${group.runCount} runs`;
  wrap.appendChild(title);

  const actions = document.createElement("div");
  actions.className = "group-details-actions";

  const runIds = group.runs.map((run) => run?.run_id).filter(Boolean);
  const allSelected =
    runIds.length > 0 && runIds.every((runId) => state.compareRunIds.includes(runId));
  const selectAllButton = document.createElement("button");
  selectAllButton.type = "button";
  selectAllButton.className = "group-details-action";
  selectAllButton.textContent = allSelected ? "Clear selected runs" : "Select all runs";
  selectAllButton.disabled = runIds.length === 0;
  selectAllButton.addEventListener("click", (event) => {
    event.stopPropagation();
    runIds.forEach((runId) => setCompareRunSelected(runId, !allSelected));
    renderAll();
  });
  actions.appendChild(selectAllButton);

  const selectedCount = runIds.filter((runId) => state.compareRunIds.includes(runId)).length;
  const compareSelectedButton = document.createElement("button");
  compareSelectedButton.type = "button";
  compareSelectedButton.className = "group-details-action ghost";
  compareSelectedButton.textContent =
    selectedCount > 0
      ? `Compare selected runs (${selectedCount})`
      : "Compare selected runs";
  compareSelectedButton.disabled = selectedCount === 0;
  compareSelectedButton.addEventListener("click", (event) => {
    event.stopPropagation();
    state.groupFilter = "all";
    elements.groupFilter.value = "all";
    state.expandedGroupKeys.add(group.key);
    syncSelection();
    setCompareWorkspaceVisible(true, {
      scroll: true
    });
  });
  actions.appendChild(compareSelectedButton);
  wrap.appendChild(actions);

  const tableWrap = document.createElement("div");
  tableWrap.className = "group-run-table-wrap";
  const table = document.createElement("table");
  table.className = "group-run-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Select", "Variant", "Metric", "Status", "Updated", "Actions"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const referenceRun = getGroupReferenceRun(group.key, group.runs);
  const referenceConfig = getRunConfig(referenceRun, true);
  const sortedRuns = group.runs
    .slice()
    .map((run, index) => {
      const metricValue = getMetricValue(run);
      const updatedRaw = getRunUpdatedAt(run);
      const updatedTs = updatedRaw ? new Date(updatedRaw).getTime() : Number.NEGATIVE_INFINITY;
      return {
        run,
        index,
        metricValue,
        updatedRaw,
        updatedTs: Number.isNaN(updatedTs) ? Number.NEGATIVE_INFINITY : updatedTs
      };
    })
    .sort((left, right) => {
      const metricCompare = compareNullableNumbers(
        left.metricValue,
        right.metricValue,
        "desc"
      );
      if (metricCompare !== 0) {
        return metricCompare;
      }
      const updatedCompare = compareNullableNumbers(left.updatedTs, right.updatedTs, "desc");
      if (updatedCompare !== 0) {
        return updatedCompare;
      }
      return left.index - right.index;
    });

  sortedRuns.forEach((entry) => {
    const run = entry.run;
    const runConfig = getRunConfig(run, true);
    const isGroupBaseline = referenceRun?.run_id === run.run_id;
    const variantLabel = getConfigDerivedVariantLabel(
      group.runs,
      run,
      referenceRun,
      runConfig,
      referenceConfig
    );
    const tr = document.createElement("tr");
    tr.className = "group-run-row";
    if (run.run_id === state.selectedRunId) {
      tr.classList.add("active");
    }
    tr.addEventListener("click", () => {
      selectRun(run.run_id);
    });

    const selectCell = document.createElement("td");
    selectCell.className = "group-run-select";
    const selectInput = document.createElement("input");
    selectInput.type = "checkbox";
    selectInput.checked = state.compareRunIds.includes(run.run_id);
    selectInput.setAttribute("aria-label", `Select ${getVariantLabel(run)} for comparison`);
    selectInput.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    selectInput.addEventListener("change", (event) => {
      event.stopPropagation();
      setCompareRunSelected(run.run_id, Boolean(event.target.checked));
      renderAll();
    });
    selectCell.appendChild(selectInput);
    tr.appendChild(selectCell);

    const variantCell = document.createElement("td");
    variantCell.className = "group-run-variant";
    const variantPrimary = document.createElement("span");
    variantPrimary.className = "table-primary";
    variantPrimary.textContent = variantLabel;
    variantPrimary.title = getVariantRawLabel(run);
    const variantSecondary = document.createElement("span");
    variantSecondary.className = "table-secondary";
    variantSecondary.textContent =
      variantLabel !== getVariantLabel(run) ? getVariantLabel(run) : "";
    variantCell.appendChild(variantPrimary);
    if (variantSecondary.textContent) {
      variantCell.appendChild(variantSecondary);
    }
    tr.appendChild(variantCell);

    tr.appendChild(createCell(entry.metricValue !== null ? formatNumber(entry.metricValue) : "—"));
    tr.appendChild(createCell(STATUS_LABELS[run.status] || run.status || "—"));
    tr.appendChild(createCell(formatDate(entry.updatedRaw)));

    const actionsCell = document.createElement("td");
    actionsCell.className = "group-run-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "group-run-open";
    openButton.textContent = "Open";
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      selectRun(run.run_id);
    });

    const baselineButton = document.createElement("button");
    baselineButton.type = "button";
    baselineButton.className = "group-run-baseline";
    baselineButton.textContent = isGroupBaseline ? "Baseline" : "Set baseline";
    baselineButton.disabled = isGroupBaseline;
    baselineButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.groupBaselineRunIds.set(group.key, run.run_id);
      persistGroupBaselineOverrides();
      renderAll();
    });

    actionsCell.appendChild(openButton);
    actionsCell.appendChild(baselineButton);
    tr.appendChild(actionsCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  detailCell.appendChild(wrap);
  detailRow.appendChild(detailCell);
  return detailRow;
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

function createCompareMatrixMetric(label, value, tone = "neutral") {
  const row = document.createElement("div");
  row.className = "compare-matrix-metric";

  const name = document.createElement("span");
  name.className = "compare-matrix-metric-label";
  name.textContent = label;

  const metricValue = document.createElement("span");
  metricValue.className = `compare-matrix-metric-value ${tone}`;
  metricValue.textContent = value;

  row.appendChild(name);
  row.appendChild(metricValue);
  return row;
}

function compareAllValuesEqual(values) {
  if (!Array.isArray(values) || values.length <= 1) {
    return true;
  }
  const first = values[0];
  return values.every((value) => configValuesEqual(value, first));
}

function buildWorkspaceKnobRows(compareRuns, configByRunId) {
  const rows = [];

  CONFIG_DIFF_REGISTRY.forEach((spec) => {
    const values = compareRuns.map((run) => readConfigKey(configByRunId.get(run.run_id), spec));
    if (values.every((value) => value === undefined)) {
      return;
    }
    if (compareAllValuesEqual(values)) {
      return;
    }
    rows.push({
      key: spec.key,
      label: spec.label,
      group: spec.group || "Other",
      helpText: buildConfigHelpText(spec),
      values,
      format: spec.format || null,
      isUnknown: false
    });
  });

  return rows.sort((left, right) => {
    const groupCompare = (left.group || "").localeCompare(right.group || "");
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return (left.label || "").localeCompare(right.label || "");
  });
}

function renderWorkspaceKnobTable(compareRuns, configByRunId) {
  elements.compareKnobHead.innerHTML = "";
  elements.compareKnobBody.innerHTML = "";

  const headRow = document.createElement("tr");
  const knobHeader = document.createElement("th");
  knobHeader.textContent = "Knob";
  headRow.appendChild(knobHeader);
  compareRuns.forEach((run) => {
    const th = document.createElement("th");
    th.textContent = shortenLabel(
      getRunVariantDeltaLabel(run, {
        loadIfMissing: true
      }),
      26
    );
    headRow.appendChild(th);
  });
  elements.compareKnobHead.appendChild(headRow);

  const rows = buildWorkspaceKnobRows(compareRuns, configByRunId);
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "muted";
    td.colSpan = compareRuns.length + 1;
    td.textContent = "No intentional knob differences across selected runs.";
    tr.appendChild(td);
    elements.compareKnobBody.appendChild(tr);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    if (row.isUnknown) {
      tr.classList.add("unknown");
    }
    if (index === 0 || rows[index - 1].group !== row.group) {
      tr.classList.add("group-start");
    }

    const labelCell = document.createElement("td");
    labelCell.className = "knob-label";
    labelCell.textContent = `${row.group} · ${row.label}`;
    if (row.helpText) {
      labelCell.title = row.helpText;
    }
    tr.appendChild(labelCell);

    row.values.forEach((value) => {
      const valueCell = document.createElement("td");
      valueCell.textContent = formatConfigValue(value, row.format);
      tr.appendChild(valueCell);
    });

    elements.compareKnobBody.appendChild(tr);
  });
}

function renderComparisonWorkspace() {
  elements.compareSelected.innerHTML = "";
  elements.compareMatrix.innerHTML = "";
  elements.compareKnobHead.innerHTML = "";
  elements.compareKnobBody.innerHTML = "";

  const filteredRuns = getFilteredRuns();
  const compareRuns = getCompareRuns();
  const trueBaselineRun = getTrueBaselineRun();
  const trueBaselineConfig = trueBaselineRun ? getRunConfig(trueBaselineRun, true) : null;
  elements.compareCount.textContent = `${compareRuns.length}/${MAX_COMPARE_RUNS} selected`;
  elements.compareAddSelected.disabled = !state.selectedRunId;
  elements.compareClear.disabled = compareRuns.length === 0;

  const pickerValue = elements.compareRunPicker.value;
  elements.compareRunPicker.innerHTML = "";
  const pickerRuns = filteredRuns
    .slice()
    .sort((a, b) => getRunSortTimestamp(b, 0) - getRunSortTimestamp(a, 0));
  pickerRuns.forEach((run) => {
    const option = document.createElement("option");
    option.value = run.run_id;
    const metricValue = getMetricValue(run);
    option.textContent = `${shortenLabel(getVariantLabel(run), 34)} · ${
      metricValue !== null ? formatNumber(metricValue) : "—"
    }`;
    elements.compareRunPicker.appendChild(option);
  });
  elements.compareAddPicker.disabled = pickerRuns.length === 0;
  if (pickerRuns.some((run) => run.run_id === pickerValue)) {
    elements.compareRunPicker.value = pickerValue;
  } else if (state.selectedRunId && pickerRuns.some((run) => run.run_id === state.selectedRunId)) {
    elements.compareRunPicker.value = state.selectedRunId;
  }

  compareRuns.forEach((run) => {
    const variantDeltaLabel = getRunVariantDeltaLabel(run, {
      loadIfMissing: true
    });
    const chip = document.createElement("div");
    chip.className = "compare-chip";
    if (run.run_id === state.selectedRunId) {
      chip.classList.add("active");
    }
    chip.addEventListener("click", () => selectRun(run.run_id));

    const label = document.createElement("span");
    label.className = "compare-chip-label";
    label.textContent = shortenLabel(variantDeltaLabel, 34);
    label.title = `${getVariantLabel(run)} | ${variantDeltaLabel}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "compare-chip-remove";
    remove.textContent = "x";
    remove.title = `Remove ${getVariantLabel(run)} from compare`;
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeCompareRun(run.run_id);
      renderAll();
    });

    chip.appendChild(label);
    chip.appendChild(remove);
    elements.compareSelected.appendChild(chip);
  });

  if (state.indexLoading) {
    setCompareState("Loading experiment index…");
    return;
  }
  if (state.indexError) {
    setCompareState(`Unable to load index: ${state.indexError}`, "error");
    return;
  }
  if (!state.indexData) {
    setCompareState("Load an index to compare runs.");
    return;
  }
  if (compareRuns.length < 2) {
    setCompareState(
      "Select at least two runs to compare side-by-side using run checkboxes.",
      "empty"
    );
    return;
  }

  clearCompareState();

  const targetRun = getBaselineToBeatRun();
  const baselineMetric = trueBaselineRun ? getMetricValue(trueBaselineRun) : null;
  const targetMetric = targetRun ? getMetricValue(targetRun) : null;

  const configByRunId = new Map();
  let configReady = true;
  let configError = null;

  compareRuns.forEach((run) => {
    const summaryEntry = ensureSummaryEntry(run);
    const summary = summaryEntry?.data;
    const accuracy =
      typeof run?.metrics?.accuracy === "number"
        ? run.metrics.accuracy
        : summary?.metrics?.accuracy ?? null;
    const loss =
      typeof run?.metrics?.loss === "number" ? run.metrics.loss : summary?.metrics?.loss ?? null;
    const topKAccuracy =
      run?.metrics?.top_k && typeof run.metrics.top_k.accuracy === "number"
        ? run.metrics.top_k.accuracy
        : summary?.metrics?.top_k && typeof summary.metrics.top_k.accuracy === "number"
          ? summary.metrics.top_k.accuracy
          : null;
    const metricValue = getMetricValue(run);
    const deltaVsBaseline = computeDelta(metricValue, baselineMetric);
    const deltaVsTarget = computeDelta(metricValue, targetMetric);

    let runConfig = null;
    if (summaryEntry?.data?.paths?.config) {
      const configState = resolveConfigState(run.run_id, summaryEntry, summaryEntry.data.paths.config);
      if (configState.status === "ready") {
        runConfig = configState.data;
        configByRunId.set(run.run_id, runConfig);
      } else if (configState.status === "error") {
        configReady = false;
        configError = configState.message;
      } else {
        configReady = false;
      }
    } else {
      configReady = false;
    }

    const runKnobSignature = getRunKnobSignature(run, trueBaselineRun, trueBaselineConfig, {
      runConfig,
      loadIfMissing: true,
      visibleTokenCount: 4
    });
    const variantDeltaLabel = getRunVariantDeltaLabel(run, {
      runConfig,
      loadIfMissing: true
    });
    let knobSummary = runKnobSignature.text;
    if (runKnobSignature.status === "changed") {
      knobSummary = `${runKnobSignature.changedCount} knob changes vs baseline: ${runKnobSignature.text}`;
    } else if (runKnobSignature.status === "matching") {
      knobSummary = "Matches baseline (0 changes)";
    } else if (runKnobSignature.status === "baseline") {
      knobSummary = "Baseline reference (0 changes)";
    }

    const card = document.createElement("article");
    card.className = "compare-matrix-card";
    if (run.run_id === state.selectedRunId) {
      card.classList.add("active");
    }
    card.addEventListener("click", (event) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        addCompareRun(run.run_id);
      }
      selectRun(run.run_id);
    });

    const cardHeader = document.createElement("div");
    cardHeader.className = "compare-matrix-header";
    const title = document.createElement("h4");
    title.textContent = shortenLabel(variantDeltaLabel, 42);
    title.title = `${getVariantLabel(run)} | ${variantDeltaLabel}`;
    const status = document.createElement("span");
    status.className = `status-badge status-${run.status || "planned"}`;
    status.textContent = STATUS_LABELS[run.status] || run.status || "—";
    cardHeader.appendChild(title);
    cardHeader.appendChild(status);

    const subtitle = document.createElement("p");
    subtitle.className = "muted";
    subtitle.textContent = `${getGroupLabel(run)} · ${getVariantLabel(run)}`;

    const metrics = document.createElement("div");
    metrics.className = "compare-matrix-metrics";
    metrics.appendChild(createCompareMatrixMetric("Accuracy", formatNumber(accuracy)));
    metrics.appendChild(createCompareMatrixMetric("Loss", formatNumber(loss)));
    if (topKAccuracy !== null) {
      metrics.appendChild(createCompareMatrixMetric("Top-k", formatNumber(topKAccuracy)));
    }
    metrics.appendChild(
      createCompareMatrixMetric(
        "Delta vs true baseline",
        deltaVsBaseline !== null ? formatDelta(deltaVsBaseline) : "—",
        deltaVsBaseline > 0 ? "positive" : deltaVsBaseline < 0 ? "negative" : "neutral"
      )
    );
    metrics.appendChild(
      createCompareMatrixMetric(
        "Delta vs target",
        deltaVsTarget !== null ? formatDelta(deltaVsTarget) : "—",
        deltaVsTarget > 0 ? "positive" : deltaVsTarget < 0 ? "negative" : "neutral"
      )
    );

    const knob = document.createElement("p");
    knob.className = "compare-matrix-knobs";
    knob.textContent = knobSummary;

    card.appendChild(cardHeader);
    card.appendChild(subtitle);
    card.appendChild(metrics);
    card.appendChild(knob);
    elements.compareMatrix.appendChild(card);
  });

  if (compareRuns.length >= 2) {
    if (configError) {
      setCompareState(`Config comparison warning: ${configError}`, "error");
    } else if (!configReady || configByRunId.size !== compareRuns.length) {
      setCompareState("Loading config artifacts for variable comparison…");
    }
  }

  if (configByRunId.size === compareRuns.length) {
    renderWorkspaceKnobTable(compareRuns, configByRunId);
  } else {
    const headRow = document.createElement("tr");
    const knobHeader = document.createElement("th");
    knobHeader.textContent = "Knob";
    headRow.appendChild(knobHeader);
    compareRuns.forEach((run) => {
      const th = document.createElement("th");
      th.textContent = shortenLabel(
        getRunVariantDeltaLabel(run, {
          loadIfMissing: true
        }),
        26
      );
      headRow.appendChild(th);
    });
    elements.compareKnobHead.appendChild(headRow);

    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "muted";
    td.colSpan = compareRuns.length + 1;
    td.textContent = "Config variables will appear once selected run configs are loaded.";
    tr.appendChild(td);
    elements.compareKnobBody.appendChild(tr);
  }
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
  const descriptionText = summary?.description || "";
  const hasDescription =
    descriptionText &&
    descriptionText !== "Legacy training run summary." &&
    descriptionText !== "No description yet.";
  description.textContent = hasDescription ? descriptionText : "Run summary";

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
  if (hasDescription) {
    elements.detailBody.appendChild(description);
  }
  elements.detailBody.appendChild(detailGrid);
  elements.detailBody.appendChild(metrics);
  elements.detailBody.appendChild(comparison);
  elements.detailBody.appendChild(renderConfigDiffSection(selectedRun, summaryEntry));
  elements.detailBody.appendChild(renderPerSlotSection(summary, selectedRun.run_id));
  elements.detailBody.appendChild(artifacts);
  elements.detailBody.appendChild(renderInspectionSection(selectedRun, summaryEntry));
}

function resolveConfigState(runId, summaryEntry, relativePath) {
  if (!relativePath) {
    return {
      status: "missing",
      message: "Config artifact was not published for this run."
    };
  }

  const cached = state.configCache.get(runId);
  if (cached?.data) {
    return {
      status: "ready",
      data: cached.data
    };
  }

  const error = state.configError.get(runId);
  if (error) {
    return {
      status: "error",
      message: error
    };
  }

  if (!state.configLoading.has(runId)) {
    fetchConfig(runId, summaryEntry, relativePath);
  }
  return {
    status: "loading"
  };
}

function renderConfigDiffSection(selectedRun, selectedSummaryEntry) {
  const section = document.createElement("section");
  section.className = "config-diff";

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("h4");
  title.textContent = "Config Diff vs True Baseline";
  const count = document.createElement("span");
  count.className = "pill muted-pill";
  header.appendChild(title);
  header.appendChild(count);
  section.appendChild(header);

  const body = document.createElement("div");
  body.className = "config-diff-body";

  const baselineRun = getTrueBaselineRun();
  if (!baselineRun) {
    count.textContent = "No baseline";
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "True baseline run is not set in this index.";
    body.appendChild(empty);
    section.appendChild(body);
    return section;
  }

  const context = document.createElement("p");
  context.className = "muted";
  context.textContent = `Baseline: ${getVariantLabel(baselineRun)}`;
  body.appendChild(context);

  let baselineSummaryEntry = null;
  if (baselineRun.run_id === selectedRun.run_id) {
    baselineSummaryEntry = selectedSummaryEntry;
  } else {
    baselineSummaryEntry = ensureSummaryEntry(baselineRun);
    const summaryLoadError = state.summaryBackgroundError.get(baselineRun.run_id);
    if (summaryLoadError) {
      count.textContent = "Summary error";
      const error = document.createElement("p");
      error.className = "muted";
      error.textContent = `Unable to load baseline summary: ${summaryLoadError}`;
      body.appendChild(error);
      section.appendChild(body);
      return section;
    }
    if (!baselineSummaryEntry) {
      count.textContent = "Loading";
      const loading = document.createElement("p");
      loading.className = "muted";
      loading.textContent = "Loading baseline summary for config comparison…";
      body.appendChild(loading);
      section.appendChild(body);
      return section;
    }
  }

  const selectedConfigPath = selectedSummaryEntry?.data?.paths?.config;
  const baselineConfigPath = baselineSummaryEntry?.data?.paths?.config;
  const selectedConfigState = resolveConfigState(
    selectedRun.run_id,
    selectedSummaryEntry,
    selectedConfigPath
  );
  const baselineConfigState =
    baselineRun.run_id === selectedRun.run_id
      ? selectedConfigState
      : resolveConfigState(baselineRun.run_id, baselineSummaryEntry, baselineConfigPath);

  const states = [selectedConfigState, baselineConfigState];
  const errorState = states.find((stateEntry) => stateEntry.status === "error");
  if (errorState) {
    count.textContent = "Config error";
    const error = document.createElement("p");
    error.className = "muted";
    error.textContent = errorState.message || "Unable to load config artifacts.";
    body.appendChild(error);
    section.appendChild(body);
    return section;
  }

  const missingState = states.find((stateEntry) => stateEntry.status === "missing");
  if (missingState) {
    count.textContent = "Missing config";
    const missing = document.createElement("p");
    missing.className = "muted";
    missing.textContent = missingState.message;
    body.appendChild(missing);
    section.appendChild(body);
    return section;
  }

  const loadingState = states.some((stateEntry) => stateEntry.status === "loading");
  if (loadingState) {
    count.textContent = "Loading";
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Loading config artifacts for diff…";
    body.appendChild(loading);
    section.appendChild(body);
    return section;
  }

  const diff = buildConfigDiffRows(selectedConfigState.data, baselineConfigState.data);
  const isBaselineSnapshot = baselineRun.run_id === selectedRun.run_id;

  if (isBaselineSnapshot) {
    title.textContent = "True Baseline Config Snapshot";
    count.textContent = `${diff.allRows.length} tracked`;
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Selected run is the true baseline. Showing tracked knob values.";
    body.appendChild(note);
    if (diff.allRows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No tracked config knobs were found in this run config.";
      body.appendChild(empty);
      section.appendChild(body);
      return section;
    }

    appendGroupedConfigRows(body, diff.allRows, (row) =>
      createConfigDiffRow(row, { selectedLabel: "Value", includeBaseline: false })
    );

    section.appendChild(body);
    return section;
  }

  count.textContent = `${diff.changedRows.length} changed`;

  if (diff.changedRows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No tracked config differences from the true baseline.";
    body.appendChild(empty);
    section.appendChild(body);
    return section;
  }

  appendGroupedConfigRows(body, diff.changedRows, (row) => createConfigDiffRow(row));

  const stableCount = document.createElement("p");
  stableCount.className = "muted";
  stableCount.textContent = `Tracked knobs unchanged: ${diff.unchangedCount}`;
  body.appendChild(stableCount);

  section.appendChild(body);
  return section;
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

  const sampledRows = rows.filter(
    (row) => row.total > 0 && typeof row.accuracy === "number" && !Number.isNaN(row.accuracy)
  );
  const bestSlot = sampledRows.reduce((best, row) => {
    if (!best || row.accuracy > best.accuracy) {
      return row;
    }
    return best;
  }, null);
  const worstSlot = sampledRows.reduce((worst, row) => {
    if (!worst || row.accuracy < worst.accuracy) {
      return row;
    }
    return worst;
  }, null);

  const extremes = document.createElement("div");
  extremes.className = "per-slot-extremes";
  extremes.appendChild(createPerSlotExtreme("Best", bestSlot));
  extremes.appendChild(createPerSlotExtreme("Worst", worstSlot));
  body.appendChild(extremes);

  const breakdownGroups = buildPerSlotBreakdownGroups(rows);
  if (breakdownGroups.length > 0) {
    body.appendChild(createPerSlotBreakdownSection(breakdownGroups));
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

function createPerSlotExtreme(label, row) {
  const card = document.createElement("div");
  card.className = "per-slot-extreme";

  const heading = document.createElement("span");
  heading.className = "per-slot-extreme-label";
  heading.textContent = label;

  const value = document.createElement("span");
  value.className = "per-slot-extreme-value";
  value.textContent = row
    ? `${formatTeamSlotLabel(row)} (${formatPercent(row.accuracy)})`
    : "—";

  card.appendChild(heading);
  card.appendChild(value);
  return card;
}

function isSampledPerSlotRow(row) {
  return (
    row &&
    row.total > 0 &&
    typeof row.accuracy === "number" &&
    !Number.isNaN(row.accuracy)
  );
}

function summarizePerSlotSlice(rows, predicate) {
  const matched = rows.filter((row) => isSampledPerSlotRow(row) && predicate(row));
  if (matched.length === 0) {
    return null;
  }
  const correct = matched.reduce((sum, row) => sum + row.correct, 0);
  const total = matched.reduce((sum, row) => sum + row.total, 0);
  if (total <= 0) {
    return null;
  }
  return {
    slotCount: matched.length,
    correct,
    total,
    accuracy: correct / total
  };
}

function buildPerSlotBreakdownGroups(rows) {
  const groups = [
    {
      title: "Action Type",
      definitions: [
        { label: "All picks", predicate: (row) => row.canonicalType === "pick" },
        { label: "All bans", predicate: (row) => row.canonicalType === "ban" }
      ]
    },
    {
      title: "By Team",
      definitions: [
        { label: "Team 1 (all)", predicate: (row) => row.canonicalTeam === "team_1" },
        { label: "Team 2 (all)", predicate: (row) => row.canonicalTeam === "team_2" },
        {
          label: "Team 1 picks",
          predicate: (row) => row.canonicalTeam === "team_1" && row.canonicalType === "pick"
        },
        {
          label: "Team 2 picks",
          predicate: (row) => row.canonicalTeam === "team_2" && row.canonicalType === "pick"
        },
        {
          label: "Team 1 bans",
          predicate: (row) => row.canonicalTeam === "team_1" && row.canonicalType === "ban"
        },
        {
          label: "Team 2 bans",
          predicate: (row) => row.canonicalTeam === "team_2" && row.canonicalType === "ban"
        }
      ]
    },
    {
      title: "Draft Phases",
      definitions: [
        {
          label: "Ban phase 1 (1-3)",
          predicate: (row) =>
            row.canonicalType === "ban" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 1 &&
            row.canonicalNum <= 3
        },
        {
          label: "Ban phase 2 (4-5)",
          predicate: (row) =>
            row.canonicalType === "ban" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 4 &&
            row.canonicalNum <= 5
        },
        {
          label: "Pick opener (1)",
          predicate: (row) =>
            row.canonicalType === "pick" && typeof row.canonicalNum === "number" && row.canonicalNum === 1
        },
        {
          label: "Pick mid phase (2-3)",
          predicate: (row) =>
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 2 &&
            row.canonicalNum <= 3
        },
        {
          label: "Pick late phase (4-5)",
          predicate: (row) =>
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 4 &&
            row.canonicalNum <= 5
        }
      ]
    },
    {
      title: "Team + Pick Phase",
      definitions: [
        {
          label: "Team 1 pick 1",
          predicate: (row) =>
            row.canonicalTeam === "team_1" &&
            row.canonicalType === "pick" &&
            row.canonicalNum === 1
        },
        {
          label: "Team 2 pick 1",
          predicate: (row) =>
            row.canonicalTeam === "team_2" &&
            row.canonicalType === "pick" &&
            row.canonicalNum === 1
        },
        {
          label: "Team 2 picks 2-3",
          predicate: (row) =>
            row.canonicalTeam === "team_2" &&
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 2 &&
            row.canonicalNum <= 3
        },
        {
          label: "Team 1 picks 2-3",
          predicate: (row) =>
            row.canonicalTeam === "team_1" &&
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 2 &&
            row.canonicalNum <= 3
        },
        {
          label: "Team 2 picks 4-5",
          predicate: (row) =>
            row.canonicalTeam === "team_2" &&
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 4 &&
            row.canonicalNum <= 5
        },
        {
          label: "Team 1 picks 4-5",
          predicate: (row) =>
            row.canonicalTeam === "team_1" &&
            row.canonicalType === "pick" &&
            typeof row.canonicalNum === "number" &&
            row.canonicalNum >= 4 &&
            row.canonicalNum <= 5
        }
      ]
    }
  ];

  return groups
    .map((group) => {
      const entries = group.definitions
        .map((definition) => {
          const summary = summarizePerSlotSlice(rows, definition.predicate);
          if (!summary) {
            return null;
          }
          return {
            label: definition.label,
            ...summary
          };
        })
        .filter(Boolean);
      return {
        title: group.title,
        entries
      };
    })
    .filter((group) => group.entries.length > 0);
}

function createPerSlotBreakdownSection(groups) {
  const section = document.createElement("div");
  section.className = "per-slot-breakdown";

  const heading = document.createElement("p");
  heading.className = "per-slot-breakdown-title";
  heading.textContent = "Breakdown";
  section.appendChild(heading);

  groups.forEach((group) => {
    const block = document.createElement("div");
    block.className = "per-slot-breakdown-group";

    const title = document.createElement("p");
    title.className = "per-slot-breakdown-group-title";
    title.textContent = group.title;
    block.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "per-slot-breakdown-grid";

    group.entries.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "per-slot-breakdown-card";

      const label = document.createElement("span");
      label.className = "per-slot-breakdown-label";
      label.textContent = entry.label;

      const value = document.createElement("span");
      value.className = "per-slot-breakdown-value";
      value.textContent = formatPercent(entry.accuracy);

      const meta = document.createElement("span");
      meta.className = "per-slot-breakdown-meta";
      meta.textContent = `${formatInteger(entry.correct)}/${formatInteger(entry.total)} correct · ${entry.slotCount} slots`;

      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(meta);
      grid.appendChild(card);
    });

    block.appendChild(grid);
    section.appendChild(block);
  });

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

function classifyInspectionPrediction(actual, topKEntries) {
  const actualName = typeof actual === "string" ? actual.trim() : "";
  if (
    actualName.length === 0 ||
    actualName === "—" ||
    !Array.isArray(topKEntries) ||
    topKEntries.length === 0
  ) {
    return {
      rank: "na",
      label: "No comparable target"
    };
  }

  const champions = topKEntries
    .map((entry) => entry?.champion)
    .filter((champion) => typeof champion === "string" && champion.length > 0)
    .map((champion) => champion.trim().toLowerCase());
  const actualRank = champions.indexOf(actualName.toLowerCase());
  if (actualRank === 0) {
    return {
      rank: "top1",
      label: "Top-1 match"
    };
  }
  if (actualRank > 0) {
    return {
      rank: "top5",
      label: "In top-5 (not top-1)"
    };
  }
  return {
    rank: "out",
    label: "Missed top-5"
  };
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
  const predictionState = classifyInspectionPrediction(actual, topKEntries);

  const predictionBlock = document.createElement("div");
  predictionBlock.className = "inspection-item-prediction";
  predictionBlock.classList.add(`rank-${predictionState.rank}`);
  predictionBlock.appendChild(createInspectionPredictionRow("Model top-1", predicted));
  predictionBlock.appendChild(createInspectionPredictionRow("Actual", actual));
  predictionBlock.appendChild(createInspectionPredictionRow("Top-k", topKText));

  const predictionBadge = document.createElement("span");
  predictionBadge.className = "inspection-item-prediction-badge";
  predictionBadge.classList.add(`rank-${predictionState.rank}`);
  predictionBadge.textContent = predictionState.label;
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

async function fetchConfig(runId, summaryEntry, relativePath) {
  if (!summaryEntry?.summaryUrl) {
    state.configError.set(runId, "Missing summary URL for config artifact.");
    return;
  }
  if (state.configLoading.has(runId)) {
    return;
  }

  state.configLoading.add(runId);
  state.configError.delete(runId);
  renderAll();

  try {
    const configUrl = new URL(relativePath, summaryEntry.summaryUrl).toString();
    const response = await fetch(withCacheBust(configUrl), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Config fetch failed (${response.status})`);
    }
    const data = await response.json();
    state.configCache.set(runId, {
      data,
      configUrl
    });
  } catch (error) {
    state.configError.set(runId, error.message || "Unable to load config artifact.");
  } finally {
    state.configLoading.delete(runId);
    renderAll();
  }
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
  const groupCounts = new Map();
  runs.forEach((run) => {
    const key = getGroupKey(run);
    groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
  });

  populateSelect(elements.statusFilter, statusOptions, (option) =>
    option === "all" ? "All statuses" : STATUS_LABELS[option] || option
  );
  populateSelect(elements.groupFilter, groupOptions, (option) =>
    option === "all"
      ? `All groups (${runs.length} runs)`
      : `${getGroupLabelByKey(option)} (${groupCounts.get(option) || 0})`
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
  const rawPath =
    sources.length > 1 ? `Auto (${sources.length} sources)` : indexPath || sources[0] || "—";
  if (sources.length > 1) {
    elements.indexPath.textContent = rawPath;
  } else {
    elements.indexPath.textContent = compactPath(rawPath);
  }
  elements.indexPath.title = rawPath;
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

function setDetailState(message, type) {
  elements.detailState.textContent = message;
  elements.detailState.className = `state${type ? ` ${type}` : ""}`;
  elements.detailState.style.display = "block";
}

function clearDetailState() {
  elements.detailState.style.display = "none";
}

function setCompareState(message, type) {
  elements.compareState.textContent = message;
  elements.compareState.className = `state${type ? ` ${type}` : ""}`;
  elements.compareState.style.display = "block";
}

function clearCompareState() {
  elements.compareState.style.display = "none";
}

function shortenLabel(value, maxLength = 34) {
  const text = String(value || "—");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function sanitizeCompareSelection() {
  const runIds = new Set(getRuns().map((run) => run?.run_id).filter(Boolean));
  state.compareRunIds = state.compareRunIds.filter((runId) => runIds.has(runId));
}

function sanitizeGroupBaselineOverrides() {
  const validByGroup = new Map();
  getRuns().forEach((run) => {
    const groupKey = getGroupKey(run);
    const entries = validByGroup.get(groupKey) || new Set();
    if (run?.run_id) {
      entries.add(run.run_id);
    }
    validByGroup.set(groupKey, entries);
  });

  let changed = false;
  Array.from(state.groupBaselineRunIds.entries()).forEach(([groupKey, runId]) => {
    const allowed = validByGroup.get(groupKey);
    if (!allowed || !allowed.has(runId)) {
      state.groupBaselineRunIds.delete(groupKey);
      changed = true;
    }
  });

  if (changed) {
    persistGroupBaselineOverrides();
  }
}

function getCompareRuns() {
  sanitizeCompareSelection();
  return state.compareRunIds.map((runId) => findRunById(runId)).filter(Boolean);
}

function includeCompareRun(runId) {
  if (!runId) {
    return;
  }
  if (state.compareRunIds.includes(runId)) {
    return;
  }
  if (state.compareRunIds.length >= MAX_COMPARE_RUNS) {
    state.compareRunIds.shift();
  }
  state.compareRunIds.push(runId);
}

function setCompareRunSelected(runId, selected) {
  if (!runId) {
    return;
  }
  if (selected) {
    includeCompareRun(runId);
    return;
  }
  removeCompareRun(runId);
}

function addCompareRun(runId) {
  if (!runId) {
    return;
  }
  const existingIndex = state.compareRunIds.indexOf(runId);
  if (existingIndex >= 0) {
    state.compareRunIds.splice(existingIndex, 1);
  } else if (state.compareRunIds.length >= MAX_COMPARE_RUNS) {
    state.compareRunIds.shift();
  }
  state.compareRunIds.push(runId);
}

function setCompareWorkspaceVisible(visible, options = {}) {
  const { scroll = false } = options;
  state.compareWorkspaceVisible = Boolean(visible);
  renderAll();
  if (state.compareWorkspaceVisible && scroll && elements.compareWorkspace) {
    elements.compareWorkspace.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function renderCompareWorkspaceVisibility() {
  const selectedCount = getCompareRuns().length;
  const label = state.compareWorkspaceVisible ? "Hide comparison" : "Show comparison";
  elements.compareWorkspaceToggle.textContent = `${label} (${selectedCount})`;
  elements.compareWorkspaceToggle.setAttribute(
    "aria-expanded",
    state.compareWorkspaceVisible ? "true" : "false"
  );
  elements.compareWorkspace.classList.toggle("is-hidden", !state.compareWorkspaceVisible);
}

function removeCompareRun(runId) {
  state.compareRunIds = state.compareRunIds.filter((candidate) => candidate !== runId);
}

function clearCompareRuns() {
  state.compareRunIds = [];
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createPrimarySecondaryCell(primary, secondary) {
  const cell = document.createElement("td");
  cell.className = "primary-secondary-cell";

  const primaryEl = document.createElement("span");
  primaryEl.className = "table-primary";
  primaryEl.textContent = primary;
  primaryEl.title = primary;

  const secondaryEl = document.createElement("span");
  secondaryEl.className = "table-secondary";
  secondaryEl.textContent = secondary || "";
  secondaryEl.title = secondary || "";

  cell.appendChild(primaryEl);
  if (secondary) {
    cell.appendChild(secondaryEl);
  }
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
  renderCompareWorkspaceVisibility();
  if (state.compareWorkspaceVisible) {
    renderComparisonWorkspace();
  }
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
  const runIds = new Set(
    (Array.isArray(result.indexData?.runs) ? result.indexData.runs : [])
      .map((run) => run?.run_id)
      .filter(Boolean)
  );
  const groupKeys = new Set(
    (Array.isArray(result.indexData?.runs) ? result.indexData.runs : [])
      .map((run) => getGroupKey(run))
      .filter(Boolean)
  );
  state.expandedGroupKeys.forEach((key) => {
    if (!groupKeys.has(key)) {
      state.expandedGroupKeys.delete(key);
    }
  });
  state.compareRunIds = state.compareRunIds.filter((runId) => runIds.has(runId));
  state.summaryCache.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.summaryCache.delete(runId);
    }
  });
  state.summaryBackgroundLoading.forEach((runId) => {
    if (!runIds.has(runId)) {
      state.summaryBackgroundLoading.delete(runId);
    }
  });
  state.summaryBackgroundError.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.summaryBackgroundError.delete(runId);
    }
  });
  state.configCache.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.configCache.delete(runId);
    }
  });
  state.configLoading.forEach((runId) => {
    if (!runIds.has(runId)) {
      state.configLoading.delete(runId);
    }
  });
  state.configError.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.configError.delete(runId);
    }
  });
  state.inspectionCache.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.inspectionCache.delete(runId);
    }
  });
  state.inspectionLoading.forEach((runId) => {
    if (!runIds.has(runId)) {
      state.inspectionLoading.delete(runId);
    }
  });
  state.inspectionError.forEach((_, runId) => {
    if (!runIds.has(runId)) {
      state.inspectionError.delete(runId);
    }
  });
  if (Array.isArray(result.summaries)) {
    result.summaries.forEach((entry) => state.summaryCache.set(entry.run_id, entry));
  }

  state.selectedRunId = preserveSelection ? priorSelection : null;
  state.statusFilter = preserveFilters ? priorStatus : "all";
  state.groupFilter = preserveFilters ? priorGroup : "all";

  rebuildGroupLabels();
  sanitizeGroupBaselineOverrides();

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
  const { silent = false, force = false } = options;

  if (state.summaryInline) {
    if (!silent) {
      state.summaryLoading = false;
      state.summaryError = null;
      renderDetail();
    }
    return;
  }

  if (!run?.run_id) {
    return;
  }

  if (!force && state.summaryCache.has(run.run_id)) {
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
    state.summaryBackgroundError.delete(run.run_id);
  } catch (error) {
    if (silent) {
      state.summaryBackgroundError.set(
        run.run_id,
        error.message || "Unable to load summary."
      );
    } else {
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
  state.summaryBackgroundLoading.clear();
  state.summaryBackgroundError.clear();
  state.configCache.clear();
  state.configLoading.clear();
  state.configError.clear();
  state.inspectionCache.clear();
  state.inspectionLoading.clear();
  state.inspectionError.clear();
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
      if (run && !state.summaryInline && !state.summaryCache.has(run.run_id)) {
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
        silent: true,
        force: true
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
      if (run && !state.summaryInline && !state.summaryCache.has(run.run_id)) {
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

  elements.compareAddSelected.addEventListener("click", () => {
    if (state.selectedRunId) {
      addCompareRun(state.selectedRunId);
      renderAll();
    }
  });

  elements.compareAddPicker.addEventListener("click", () => {
    const runId = elements.compareRunPicker.value;
    if (!runId) {
      return;
    }
    addCompareRun(runId);
    renderAll();
  });

  elements.compareClear.addEventListener("click", () => {
    clearCompareRuns();
    renderAll();
  });

  elements.compareWorkspaceToggle.addEventListener("click", () => {
    setCompareWorkspaceVisible(!state.compareWorkspaceVisible, {
      scroll: state.compareWorkspaceVisible ? false : true
    });
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
  loadGroupBaselineOverrides();
  attachEventHandlers();
  state.refreshIntervalMs = 30000;
  state.metricKey = elements.metricFilter.value || "accuracy";
  renderFilters();
  renderAll();

  loadIndexFromFetch(resolveDefaultIndexPaths(), false);
}

init();
