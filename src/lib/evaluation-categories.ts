export type CategoryMode = "locked" | "number" | "dropdown";
export type CategoryDef = {
  label: string;
  mode: CategoryMode;
  amount?: number;
  rate?: number;
  subs?: [string, number][];
};

export const EXTRA_CATS: CategoryDef[] = [
  { label: "Extra session", mode: "locked", amount: 60 },
  { label: "Cover for absent TA", mode: "locked", amount: 45 },
  { label: "Mock exam marking", mode: "dropdown", subs: [["Half day", 60], ["Full day", 120]] },
  { label: "Extra papers checked", mode: "number", rate: 8 },
  { label: "Other bonus", mode: "number", rate: 1 },
];

export const DED_CATS: CategoryDef[] = [
  { label: "Lack of consistency", mode: "dropdown", subs: [["Late checking", 20], ["Late replies", 30], ["Both", 45]] },
  { label: "Missed session", mode: "locked", amount: 50 },
  { label: "Unapproved absence", mode: "locked", amount: 80 },
  { label: "Policy breach", mode: "number", rate: 10 },
  { label: "Other deduction", mode: "number", rate: 1 },
];

export function categoryAmount(cfg: CategoryDef, qty: string, sub: string): number {
  if (cfg.mode === "locked") return cfg.amount ?? 0;
  if (cfg.mode === "number") return (Number(qty) || 0) * (cfg.rate ?? 0);
  if (cfg.mode === "dropdown") return cfg.subs?.find((s) => s[0] === sub)?.[1] ?? 0;
  return 0;
}
