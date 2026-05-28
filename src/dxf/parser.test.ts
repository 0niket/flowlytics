import { describe, it, expect } from "vitest";
import { extractLabelsFromDxfText } from "./parser";

describe("extractLabelsFromDxfText", () => {
  it("throws on empty input", () => {
    expect(() => extractLabelsFromDxfText("")).toThrow();
  });

  it("throws on invalid DXF", () => {
    expect(() => extractLabelsFromDxfText("NOT A DXF FILE")).toThrow();
  });

  it("parses TEXT entities", () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
TEXT
8
0
10
100.0
20
200.0
40
2.5
1
AS01
0
ENDSEC
0
EOF
`;
    const labels = extractLabelsFromDxfText(dxfContent);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const label = labels.find((l) => l.text === "AS01");
    expect(label).toBeDefined();
    expect(label!.x).toBeCloseTo(100);
    expect(label!.y).toBeCloseTo(200);
  });

  it("parses MTEXT entities", () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
MTEXT
8
0
10
150.0
20
250.0
40
3.0
1
HANGER LOADING
0
ENDSEC
0
EOF
`;
    const labels = extractLabelsFromDxfText(dxfContent);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const label = labels.find((l) => l.text === "HANGER LOADING");
    expect(label).toBeDefined();
  });

  it("skips non-text entities", () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
11
100.0
21
100.0
0
ENDSEC
0
EOF
`;
    const labels = extractLabelsFromDxfText(dxfContent);
    expect(labels.length).toBe(0);
  });

  it("normalizes text", () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
TEXT
8
0
10
0.0
20
0.0
40
2.5
1
  HELLO WORLD  
0
ENDSEC
0
EOF
`;
    const labels = extractLabelsFromDxfText(dxfContent);
    const label = labels.find((l) => l.text === "HELLO WORLD");
    expect(label).toBeDefined();
  });
});
