import argparse
import collections
import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import ezdxf


@dataclass(frozen=True)
class TextLabel:
    type: str
    layer: str
    text: str
    x: float
    y: float
    rotation: float | None
    height: float | None


def _norm_text(value: Any) -> str:
    # DXF often contains formatting codes and line breaks. Keep it readable and stable.
    return " ".join(str(value).replace("\\P", " ").split()).strip()


def iter_text_labels(msp: Iterable[Any]) -> list[TextLabel]:
    labels: list[TextLabel] = []
    for e in msp:
        et = e.dxftype()
        if et not in {"TEXT", "MTEXT"}:
            continue

        raw = e.dxf.text if et == "TEXT" else e.text
        text = _norm_text(raw)
        if not text:
            continue

        insert = None
        try:
            insert = e.dxf.insert  # TEXT
        except Exception:
            try:
                insert = e.dxf.insert  # MTEXT usually has insert too
            except Exception:
                insert = None

        if insert is None:
            continue

        rotation = getattr(e.dxf, "rotation", None)
        height = getattr(e.dxf, "height", None)
        labels.append(
            TextLabel(
                type=et,
                layer=e.dxf.layer,
                text=text,
                x=float(insert.x),
                y=float(insert.y),
                rotation=float(rotation) if rotation is not None else None,
                height=float(height) if height is not None else None,
            )
        )
    return labels


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory a DXF for layout parsing.")
    parser.add_argument("dxf_path", type=Path)
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()

    dxf_path: Path = args.dxf_path
    out_dir: Path = args.out_dir or dxf_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    layers = [l.dxf.name for l in doc.layers]

    type_counts: dict[str, int] = collections.Counter()
    layer_counts: dict[str, int] = collections.Counter()
    for e in msp:
        type_counts[e.dxftype()] += 1
        layer_counts[e.dxf.layer] += 1

    labels = iter_text_labels(msp)

    inventory = {
        "source": str(dxf_path),
        "layers_count": len(layers),
        "layers": sorted(layers),
        "entity_type_counts": dict(sorted(type_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "entity_layer_counts_top_50": [
            {"layer": layer, "count": count}
            for layer, count in sorted(layer_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:50]
        ],
        "text_labels_count": len(labels),
        "text_labels": [
            {
                "type": t.type,
                "layer": t.layer,
                "text": t.text,
                "x": t.x,
                "y": t.y,
                "rotation": t.rotation,
                "height": t.height,
            }
            for t in labels
        ],
    }

    json_path = out_dir / (dxf_path.stem + ".inventory.json")
    json_path.write_text(json.dumps(inventory, indent=2), encoding="utf-8")

    csv_path = out_dir / (dxf_path.stem + ".labels.csv")
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["type", "layer", "text", "x", "y", "rotation", "height"])
        for t in labels:
            w.writerow([t.type, t.layer, t.text, t.x, t.y, t.rotation, t.height])

    print(f"Wrote {json_path}")
    print(f"Wrote {csv_path}")


if __name__ == "__main__":
    main()

