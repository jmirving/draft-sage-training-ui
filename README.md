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
Open `index.html` in your browser. It auto-loads the configured experiment
indexes and merges them into one view.

## Quick launch (recommended)
Serve the repo root and print the UI URL in one command:

```bash
./draft-sage-training-ui/scripts/launch_ui.sh
```

## Default sources (auto-load)
The UI loads a fixed list of experiment indexes defined in
`draft-sage-training-ui/app.js` under `DEFAULT_INDEX_PATHS`. Update that list
whenever a new output directory should be part of the UI.

## Legacy outputs (summary.json)
Older runs may only provide a root-level `summary.json` array (for example,
`/home/jirving/projects/lol/.tmp/training-clean-2025-ep20/summary.json`).
Serve it over HTTP and add the path to `DEFAULT_INDEX_PATHS`.

## WSL-friendly serving (single command)
Serve the repo root so the UI and outputs share the same origin:

```bash
cd /home/jirving/projects/lol
python -m http.server 8000
```

Then open:
```
http://localhost:8000/draft-sage-training-ui/index.html
```

## Mock data
Sample data lives in `mock/` and follows the UI contract. It includes:
- `mock/experiment-index.json`
- Per-run `summary.json`, `config.json`, and `metrics.json`
- Dataset manifests under `mock/manifests/`
