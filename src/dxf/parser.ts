import DxfParser from "dxf-parser";
import type { IEntity } from "dxf-parser";
import type { DxfLabel } from "../types";
import { normText } from "../utils";

function textFromEntity(e: IEntity): string {
  const t = (e as unknown as Record<string, unknown>).text;
  return typeof t === "string" ? t : "";
}

function positionFromEntity(e: IEntity): { x: number; y: number; z: number } | null {
  const obj = e as unknown as Record<string, unknown>;
  if (e.type === "TEXT") {
    const sp = obj.startPoint;
    if (sp && typeof sp === "object" && "x" in (sp as Record<string, unknown>)) return sp as { x: number; y: number; z: number };
    return null;
  }
  if (e.type === "MTEXT") {
    const p = obj.position;
    if (p && typeof p === "object" && "x" in (p as Record<string, unknown>)) return p as { x: number; y: number; z: number };
    return null;
  }
  return null;
}

function numericField(e: IEntity, field: string): number | null {
  const v = (e as unknown as Record<string, unknown>)[field];
  return typeof v === "number" && isFinite(v) ? v : null;
}

export function extractLabelsFromDxfText(dxfText: string): DxfLabel[] {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);
  if (!dxf || !dxf.entities) throw new Error("Failed to parse DXF file");

  const labels: DxfLabel[] = [];
  for (const entity of dxf.entities) {
    if (entity.type !== "TEXT" && entity.type !== "MTEXT") continue;
    const text = normText(textFromEntity(entity));
    if (!text) continue;
    const pos = positionFromEntity(entity);
    if (!pos || pos.x == null || pos.y == null) continue;
    const rotation = numericField(entity, "rotation");
    const height = entity.type === "TEXT" ? numericField(entity, "textHeight") : numericField(entity, "height");
    labels.push({
      type: entity.type,
      layer: entity.layer || "0",
      text,
      x: pos.x,
      y: pos.y,
      rotation,
      height,
    });
  }
  return labels;
}
