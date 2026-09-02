/* ==================================================================
 *  SCHEMA — Types for country and tax data
 *  Shape of the static dataset. NO logic, types only.
 * ================================================================== */

/** Special, non-classic VAT systems. */
export type TaxSystem = "vat" | "us" | "ca" | "br" | "au" | "none";

/** A state / province (US, CA, AU, BR) combined rate. */
export interface SubRegion {
  code: string;
  name: string;
  /** Combined local rate as a percentage. */
  rate: number;
}

/** Human-readable text for a rule. The view fills in the {{from}}/{{to}}/
 *  {{loc}}/{{buyerRate}} placeholders with the actual transaction's country
 *  names. */
export interface RuleText {
  name: string;
  detail: string;
}

/** A human-readable example list for a reduced rate, showing WHAT this
 *  specific percentage applies to (e.g. "foodstuffs", "books, newspapers"). */
export interface ReducedRateInfo {
  /** The rate as a percentage — must match one of the entries in `reduced`. */
  rate: number;
  /** Short, list-style examples (2-6 items) of what this rate applies to. */
  items: string[];
  /** OPTIONAL. Invoice codes belonging to this rate — the codes a seller in
   *  this country puts on the line instead of a percentage. Only meaningful
   *  on the `rate: 0` entry (HU: AAM, TAM, KBAET, EUFAD37…; IT: N3.2, N4…).
   *  Empty or absent on the ordinary reduced rates, which need no code.
   *
   *  Key = the code exactly as it goes on the invoice (never translated),
   *  value = a short English explanation of what it means:
   *  `{ "AAM": "Exempt small business — subject-based exemption" }`. */
  type?: Record<string, string>;
}

/** A country's full tax profile — every tax type in one place. */
export interface Country {
  code: string;
  name: string;
  flag: string;
  /** Standard (normal) rate. */
  std: number;
  /** Reduced rates, in descending order. */
  reduced: number[];
  /** Which reduced rate applies to what (same order as the `reduced`
   *  array). May be missing if not yet populated. */
  reducedCategories?: ReducedRateInfo[];
  /** Whether it's an EU member state (the relation logic starts from this). */
  eu: boolean;
  /** Tax system type; defaults to "vat". */
  system: TaxSystem;
  /** Foreign seller's registration threshold (free text), if any. */
  threshold?: string;
  /** VAT number format pattern (regex string, from JSON) — EU countries only. */
  vatPattern?: string;
  /** State/province-level rates (us/ca/au/br only). */
  subRegions?: SubRegion[];
  /** Brazilian federal rate (br only). */
  federal?: number;
  /** Text for the rules where THIS country is the one taxing the supply
   *  (ruleKey → text). The app renders the explanation from here, so
   *  editing country.json actually changes the text the user sees. */
  rules?: Record<string, RuleText>;
}

/** Shape of the full country dataset (countries.json). */
export interface CountryDataset {
  version: string;      // e.g. "2026-01"
  currencyList: string[];
  countries: Country[];
}
