# Pretreatment Simulator (Frontend-only v0)

## Open options

### Recommended (localhost)

Browsers restrict some features (especially `fetch`) when pages are opened via `file://`.

From the repo root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/web/
```

This enables:

- The **DXF Labels → Fetch** button to load extracted CAD labels
- The **Simulation Charts** panel (throughput/WIP) to render via `fetch`/assets without browser restrictions

- `assets/cad/oda_out/Metafold layout PM-014-001-R1.labels.csv`
- `assets/cad/oda_out/Metafold layout PM-014-001-R1.inventory.json`

### Direct file open (works, with limitations)

Open `web/index.html` directly. Use **DXF Labels → Load files** (file picker) instead of **Fetch**.
