# draft-sage-training-ui

Visualization UI for DraftSage training experiments.

## Scope
- Show running, planned, and completed experiment runs
- Surface key metrics, configs, and artifacts
- Filter by experiment category and dataset lineage

## Out of scope
- Training execution or scheduling
- Data processing/normalization
- Model artifacts storage or serving

## Inputs
- Experiment metadata emitted by `draft-sage-training` using the contract in
  `project-brain/TRAINING_EXPERIMENT_UI_CONTRACT.md`.

## Outputs
- Read-only dashboards and experiment catalog views

## Quick start (no build step)
Open `index.html` in your browser. Load data by either selecting a legacy
`summary.json` file or by entering an index URL served over HTTP.

## Default index (auto-load)
When the UI is opened without `?index=`, it auto-loads the combined index at:

```
/.tmp/training-clean-2025-all/experiment-index.json
```

After new training runs, rebuild the combined index so the default stays current.
Use `draft-sage-training/scripts/build_combined_index.py` to regenerate the
combined file.

## Configure the experiment index
The UI reads the index via a query param when served over HTTP:

```
http://localhost:8000/?index=/experiments/experiment-index.json
```

The `summary_path` values in the index are resolved relative to the index file.

## Legacy outputs (summary.json)
Older runs may only provide a root-level `summary.json` array (for example,
`/home/jirving/projects/lol/.tmp/training-clean-2025-ep20/summary.json`).
The UI can load this directly:
- Click **Load summary.json** and select the file, or
- Serve the file over HTTP and use `?index=/path/to/summary.json`.

## Load local experiment outputs (HTTP)
If you prefer the query param path, serve the repo from a simple local server
so the browser can fetch JSON:

```bash
python -m http.server 8000
```

Then open (adjust the path as needed):
```
http://localhost:8000/?index=/experiments/experiment-index.json
```

## WSL-friendly serving (single command)
Serve the repo root so the UI and outputs share the same origin:

```bash
cd /home/jirving/projects/lol
python -m http.server 8000
```

Then open:
```
http://localhost:8000/draft-sage-training-ui/index.html?index=/.tmp/training-clean-2025-ep20/summary.json
```

## Mock data
Sample data lives in `mock/` and follows the UI contract. It includes:
- `mock/experiment-index.json`
- Per-run `summary.json`, `config.json`, and `metrics.json`
- Dataset manifests under `mock/manifests/`
