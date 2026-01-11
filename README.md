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

## Quick start
```bash
npm install
npm run dev
```

Open `http://localhost:5173/` to load the default mock data.

## Configure the experiment index
The UI reads the index via a query param:

```
http://localhost:5173/?index=/mock/experiment-index.json
```

The `summary_path` values in the index are resolved relative to the index file.

## Point at local experiment outputs
For local-only usage, keep everything same-origin so the browser does not block
the fetches:

1. Copy or symlink the training output directory into `public/experiments/`.
2. Use `?index=/experiments/experiment-index.json`.

Example:
```bash
ln -s /absolute/path/to/training-output ./public/experiments
```

Then open:
```
http://localhost:5173/?index=/experiments/experiment-index.json
```

## Mock data
Sample data lives in `public/mock/` and follows the UI contract. It includes:
- `public/mock/experiment-index.json`
- Per-run `summary.json`, `config.json`, and `metrics.json`
- Dataset manifests under `public/mock/manifests/`
