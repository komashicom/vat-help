/* ==================================================================
 *  VAT LIB — the ONLY integration surface.
 *  Framework-independent (no React import) — portable into Komashi.
 *
 *  Usage:
 *    import { lookup, calculate, lookupAndCalculate, checkVatId } from "./lib/vat";
 *
 *    const rec = await lookup({ from:"HU", to:"DE", supply:"service",
 *      b2b:true, serviceKind:"digital", goodsLeave:"na",
 *      overThreshold:"na", onsiteLocation:"na" });
 *    const calc = calculate(rec!, 1000);        // { rate:0, vat:0, gross:1000, buyerVat:190, … }
 *
 *  The data source is the static results.json + countries.json — the lib
 *  doesn't evaluate tax rules, it just looks up a ready-made rate and
 *  multiplies.
 * ================================================================== */
import type { ScenarioKey, ResultRecord, Jurisdiction } from "../schema/result";
import type { Country, SubRegion } from "../schema/country";
import { validateScenario } from "../schema/result";
import { normalizeKey, keyOf } from "../search/key";
import { COUNTRIES, byCode } from "../data/countries";

export type { ScenarioKey, ResultRecord } from "../schema/result";
export type { Country } from "../schema/country";
export { SUPPLIES, SERVICE_KINDS, ONSITE_LOCATIONS, validateScenario } from "../schema/result";
export { normalizeKey, keyOf } from "../search/key";
export { COUNTRIES, byCode, DATA_VERSION, CURRENCIES } from "../data/countries";

/* ------------------------------------------------------------------
 * 1) DATA LOADING + SEARCH (search query)
 * ------------------------------------------------------------------ */
interface ResultsFile { version: string; records: ResultRecord[]; }

let indexPromise: Promise<Map<string, ResultRecord>> | null = null;
let resultsUrl = "/data/results.json";

/** Optional: a different URL (e.g. a CDN or a Komashi asset path). Call this BEFORE loading. */
export function setResultsUrl(url: string): void {
  resultsUrl = url;
  indexPromise = null;
}

/** Optional: load data you already have on hand (e.g. SSR/tests). */
export function setResultsData(file: ResultsFile): void {
  indexPromise = Promise.resolve(buildIndex(file.records));
}

function buildIndex(records: ResultRecord[]): Map<string, ResultRecord> {
  const map = new Map<string, ResultRecord>();
  for (const rec of records) map.set(rec.key, rec);
  return map;
}

function loadIndex(): Promise<Map<string, ResultRecord>> {
  if (!indexPromise) {
    indexPromise = fetch(resultsUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load results.json: " + r.status);
        return r.json() as Promise<ResultsFile>;
      })
      .then((file) => buildIndex(file.records));
  }
  return indexPromise;
}

/**
 * Kicks off loading the data, but does NOT wait for it. Call this at the
 * very start of the flow: by the time the user reaches the result screen,
 * the index is already built, so the lookup is instant (no flashing
 * "Searching…"). Calling it again is cheap — `loadIndex` memoizes a
 * single promise.
 */
export function preloadResults(): void {
  void loadIndex();
}

/**
 * Looks up the pre-generated record. A pure read, no calculation.
 * Validates FIRST: if any field of the scenario isn't an allowed value
 * per the schema (or the country code is unknown), it throws — so only
 * the defined options are ever accepted.
 */
export async function lookup(raw: ScenarioKey): Promise<ResultRecord | null> {
  const errors = validateScenario(raw);
  if (byCode(raw.from) == null) errors.push(`from: unknown country "${raw.from}"`);
  if (byCode(raw.to) == null) errors.push(`to: unknown country "${raw.to}"`);
  if (errors.length) throw new Error("Invalid scenario: " + errors.join("; "));

  const wanted = keyOf(normalizeKey(raw));
  const index = await loadIndex();
  return index.get(wanted) ?? null;
}

/* ------------------------------------------------------------------
 * 2) RATE RESOLUTION + CALCULATE (works strictly off the record)
 * ------------------------------------------------------------------ */

/**
 * The rate to display. For state-based records (US/CA/BR, needsState=true)
 * this READS the selected sub-region's rate from countries.json
 * (BR: federal + state). Not a calculation — a data lookup.
 * LANGUAGE-INDEPENDENT: the jurisdiction is a code + modifier; the view
 * turns it into text.
 */
export function resolveRate(rec: ResultRecord, stateCode = ""): {
  rate: number; jurisdiction: Jurisdiction; subRegion: SubRegion | null;
} {
  if (!rec.needsState || !rec.stateCountry) return { rate: rec.rate, jurisdiction: rec.jurisdiction, subRegion: null };
  const country = byCode(rec.stateCountry);
  const sub = country?.subRegions?.find((s) => s.code === stateCode);
  if (!country || !sub) return { rate: rec.rate, jurisdiction: rec.jurisdiction, subRegion: null };
  const total = country.system === "br" ? (rec.federal ?? 0) + sub.rate : sub.rate;
  return { rate: total, jurisdiction: { country: country.code, mod: null }, subRegion: sub };
}

export interface VatCalculation {
  /** The applied rate %, resolved via the state selection if one was needed. */
  rate: number;
  /** Jurisdiction (country code + modifier) — the view turns it into text. */
  jurisdiction: Jurisdiction;
  /** The resolved sub-region (state/province), if one was selected. */
  subRegion: SubRegion | null;
  net: number;
  vat: number;
  gross: number;
  /** The rate/amount arising on the buyer's side under reverse charge (null otherwise). */
  reverseCharge: boolean;
  buyerCountry: string | null;
  buyerRate: number | null;
  buyerVat: number | null;
  /** True if the state selection is still missing for an exact rate. */
  stateRequired: boolean;
}

/**
 * Returns every number derived from the FINISHED record + the net amount.
 * Deterministic: the same input always produces the same output.
 */
export function calculate(rec: ResultRecord, net: number, stateCode = ""): VatCalculation {
  const { rate, jurisdiction, subRegion } = resolveRate(rec, stateCode);
  const safeNet = isFinite(net) && net >= 0 ? net : 0;
  const vat = safeNet * (rate / 100);
  return {
    rate,
    jurisdiction,
    subRegion,
    net: safeNet,
    vat,
    gross: safeNet + vat,
    reverseCharge: rec.reverseCharge,
    buyerCountry: rec.buyerCountry,
    buyerRate: rec.buyerRate,
    buyerVat: rec.buyerRate != null ? safeNet * (rec.buyerRate / 100) : null,
    stateRequired: rec.needsState && !stateCode,
  };
}

/** Convenience: lookup + calculate in one call. null if there's no match. */
export async function lookupAndCalculate(
  raw: ScenarioKey, net: number, stateCode = ""
): Promise<{ record: ResultRecord; calc: VatCalculation } | null> {
  const record = await lookup(raw);
  if (!record) return null;
  return { record, calc: calculate(record, net, stateCode) };
}

/* ------------------------------------------------------------------
 * 3) VAT ID VALIDATION (the pattern comes from countries.json)
 * ------------------------------------------------------------------ */
export interface VatCheck {
  ok: boolean;
  /** Error key (the view turns it into text) — null if it's fine. */
  error: "unknownCountry" | "empty" | "format" | null;
  /** On a format error: an example of the expected pattern. */
  sample?: string;
}

/** Cleans up a VAT ID: uppercase, strip spaces/hyphens/dots. */
export function cleanVatId(input: string): string {
  return input.toUpperCase().replace(/[\s.-]/g, "");
}

/**
 * Format check based on the vatPattern from the JSON.
 * For an EU country a match is mandatory; for non-EU it's just "not empty".
 * NOTE: format ≠ actual (VIES) validity.
 */
export function checkVatId(countryCode: string, input: string): VatCheck {
  const c = byCode(countryCode);
  const v = cleanVatId(input);
  if (!c) return { ok: false, error: "unknownCountry" };
  if (v.length === 0) return { ok: false, error: "empty" };
  if (!c.vatPattern) return { ok: true, error: null };
  const re = new RegExp(c.vatPattern);
  if (re.test(v)) return { ok: true, error: null };
  return { ok: false, error: "format", sample: sample(countryCode) };
}

function sample(code: string): string {
  const samples: Record<string, string> = {
    HU: "HU12345678", DE: "DE123456789", AT: "ATU12345678", FR: "FRXX123456789",
    IT: "IT12345678901", ES: "ESX1234567X", NL: "NLXXXXXXXXXXXX", PL: "PL1234567890",
  };
  return samples[code] ?? `${code}…`;
}

/* ------------------------------------------------------------------
 * 4) FILTER HELPERS (for Komashi lists / reports)
 * ------------------------------------------------------------------ */

/** All records for one seller — e.g. for a report or a country matrix. */
export async function recordsFrom(sellerCode: string): Promise<ResultRecord[]> {
  const index = await loadIndex();
  const out: ResultRecord[] = [];
  for (const rec of index.values()) if (rec.scenario.from === sellerCode) out.push(rec);
  return out;
}

/** An arbitrary filter over all records (badge, ruleId, flags…). */
export async function queryRecords(pred: (r: ResultRecord) => boolean): Promise<ResultRecord[]> {
  const index = await loadIndex();
  const out: ResultRecord[] = [];
  for (const rec of index.values()) if (pred(rec)) out.push(rec);
  return out;
}

/** Country-list helper (e.g. for a dropdown). */
export function listCountries(): Country[] {
  return COUNTRIES;
}
