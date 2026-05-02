# Flowlytics — Pretreatment Transporter Simulator

Simulate, analyze, and optimize multi-tank chemical pretreatment lines before deployment. Estimate throughput, identify bottlenecks, detect quality risks, and compare design alternatives — all in the browser.

## What it does

A chemical pretreatment line processes metal parts (mild steel, aluminum) through a sequence of chemical tanks using rail-mounted transporter wagons. This tool simulates that process and answers:

- **Can the line meet the target throughput?** (e.g., 3.5 baskets/hour)
- **Where is the bottleneck?** (wagon capacity, tank occupancy, manual loading)
- **Are there quality risks?** (over-dwell violations in chemical tanks)
- **What is the optimal inventory level?** (how many baskets should be in the system)
- **What happens if we add a wagon / change speed / reduce load time?**

## Quick start

```bash
# From the repo root
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/web/
```

That's it. The app runs entirely in the browser — no build step, no npm, no frameworks.

## First run

When the app loads, a setup wizard asks for:

1. **Plant layout** — drag-and-drop a `.dxf` file (AutoCAD drawing) to use real factory station positions, or choose "Use synthetic layout" for a generated straight-line layout
2. **Simulation targets** — set the target throughput (baskets/hr) and simulation duration

After setup, the dashboard shows KPI cards, per-station metrics, wagon analysis, and loading queue insights. Adjust any parameter in the sidebar and results update instantly.

## Features

### Dashboard
- **KPI cards** — throughput vs target, lead time, bottleneck identification, violations, wagon utilization, optimal WIP
- **Station metrics** — per-tank utilization, actual vs target dwell time, violation count
- **Wagon metrics** — per-wagon busy/idle time, zone allocation
- **Loading analysis** — queue depth, wait times, loading utilization, DBR inventory recommendations
- **Charts** — rolling throughput, WIP over time, basket Gantt timeline

### Configuration
- **Process recipe** — presets for mild steel / aluminum, or custom per-tank dwell times
- **Manual operations** — load time, unload time, drip/drag-out
- **Transport** — wagon count, speed, lift/lower time, pick/drop time
- **Simulation** — target throughput, duration, auto-run on change

### Other
- **DXF/DWG import** — load real factory layouts from AutoCAD drawings
- **Scenario comparison** — save A/B configurations and compare side-by-side
- **Searchable glossary** — 30 terms with definitions, cause/effect, and examples
- **Dark / light theme**
- **Canvas zoom/pan/fullscreen** — mouse wheel zoom, drag pan, fullscreen mode
- **Line layout preview** — animated simulation playback with scrubbing

## DWG file support (optional)

`.dxf` files are parsed directly in the browser. `.dwg` files require a conversion server:

```bash
# Check dependencies
bash scripts/setup.sh

# Start the conversion server (port 8800)
python3 scripts/serve_convert.py
```

The server uses [ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) (free, registration required) to convert `.dwg` to `.dxf`. If it's not installed, the setup script shows instructions.

**Alternative:** Export `.dxf` from AutoCAD (File > Save As > DXF) and import that directly — no server needed.

## Project structure

```
flowlytics/
  web/
    index.html          # App UI
    app.js              # Simulation engine + all UI logic (~2000 lines)
    styles.css           # Dark/light theme styles
  scripts/
    setup.sh            # Dependency checker
    serve_convert.py    # DWG→DXF conversion server
    cad/
      dxf_inventory.py  # Offline DXF label extraction (Python + ezdxf)
  assets/
    cad/
      oda_out/          # Extracted DXF labels and inventory data
  store/                # Project documentation and context
  tools/                # ODA File Converter binary (not in git)
```

## How the simulation works

The simulator uses **discrete-event simulation (DES)** with a priority queue:

1. Baskets arrive at the loading station at the target rate
2. An operator loads parts (manual time)
3. The wagon picks up the basket, travels along the rail, and drops it in the first tank
4. The basket dwells in each tank for the configured time (with tolerance window)
5. The wagon moves the basket through all tanks, then to the drying oven (WDO), then to unloading
6. Multiple baskets overlap in the system — competing for the same wagon and tanks

The simulation tracks contention (wagon busy, tank occupied), measures actual dwell times, flags violations, and computes per-component utilization. Results use Little's Law for optimal WIP calculation and Goldratt's Drum-Buffer-Rope framework for inventory analysis.

## Tech stack

- **Frontend:** Vanilla JavaScript, HTML, CSS (no frameworks, no build step)
- **Rendering:** Canvas 2D API (layout visualization), SVG (charts)
- **DXF parsing:** [dxf-parser](https://github.com/gdsestimating/dxf-parser) via CDN
- **Backend (optional):** Python stdlib HTTP server + ODA File Converter
