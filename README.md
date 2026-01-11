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
Open `index.html` in your browser. The UI can load experiment metadata using
the built-in folder picker (Chrome/Edge) or by fetching a URL.

## Configure the experiment index
The UI reads the index via a query param when served over HTTP:

```
http://localhost:8000/?index=/experiments/experiment-index.json
```

The `summary_path` values in the index are resolved relative to the index file.

## Load local experiment outputs (no server)
Use the **Select output folder** button in the UI to pick a training output
directory that contains `experiment-index.json`. This uses the File System
Access API, so it works best in Chromium-based browsers.

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

## Mock data
Sample data lives in `mock/` and follows the UI contract. It includes:
- `mock/experiment-index.json`
- Per-run `summary.json`, `config.json`, and `metrics.json`
- Dataset manifests under `mock/manifests/`
