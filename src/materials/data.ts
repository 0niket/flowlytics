export interface MaterialEntry {
  type: string;
  label: string;
}

export const MATERIALS: MaterialEntry[] = [
  { type: "mild_steel", label: "Mild Steel" },
  { type: "aluminium", label: "Aluminium" },
  { type: "stainless_steel", label: "Stainless Steel" },
  { type: "galvanised_steel", label: "Galvanised Steel" },
  { type: "cast_iron", label: "Cast Iron" },
  { type: "brass", label: "Brass" },
  { type: "copper", label: "Copper" },
  { type: "zinc_die_cast", label: "Zinc Die Cast" },
  { type: "hss", label: "HSS" },
  { type: "other", label: "Other" },
];
