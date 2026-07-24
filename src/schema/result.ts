/* ==================================================================
 *  SCHEMA — Scenario key and pre-built result record
 *  This is what the app searches WITH: it assembles a ScenarioKey and
 *  looks up the matching ResultRecord in the static JSON. No calculation.
 * ================================================================== */

/* ------------------------------------------------------------------
 * OPTION ENUMS — single source of truth.
 * The allowed values are listed in ONE place; the TypeScript types are
 * derived from them (compile time), and `validateScenario` checks
 * incoming data against these SAME values at runtime — so only these
 * are accepted, nothing else.
 * ------------------------------------------------------------------ */
export const SUPPLIES = ["product", "service"] as const;
export const SERVICE_KINDS = ["digital", "general", "onsite"] as const;
/** Physical location of an on-site service (seller's or buyer's country). */
export const ONSITE_LOCATIONS = ["seller", "customer"] as const;

export type Supply = (typeof SUPPLIES)[number];
export type ServiceKind = (typeof SERVICE_KINDS)[number];
export type OnsiteLocation = (typeof ONSITE_LOCATIONS)[number];

/**
 * Every degree of freedom of the scenario. The search key is built from
 * this. Fields that aren't relevant are set to "na" (e.g. serviceKind
 * for a product).
 */
export interface ScenarioKey {
  from: string;                 // seller's country code
  to: string;                   // buyer's country code
  supply: Supply;
  b2b: boolean;                 // buyer = VAT-registered business
  serviceKind: ServiceKind | "na";
  goodsLeave: boolean | "na";   // B2B goods: does the item leave the country
  overThreshold: boolean | "na"; // B2C EU distance sale > €10,000
  onsiteLocation: OnsiteLocation | "na";
}

/* ------------------------------------------------------------------
 * RUNTIME VALIDATION — every field of the scenario may only be one of
 * the allowed values ("na" where the schema permits it). Checks the
 * SHAPE of the country code (two uppercase letters); whether it's an
 * EXISTING country is checked by the lib (from countries.json), since
 * the schema is intentionally data-independent.
 * ------------------------------------------------------------------ */
function inSet<T extends string>(set: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (set as readonly string[]).includes(v);
}

/** List of error messages; an empty array means the scenario shape is valid. */
export function validateScenario(raw: ScenarioKey): string[] {
  const e: string[] = [];
  const isCode = (v: unknown) => typeof v === "string" && /^[A-Z]{2}$/.test(v);
  const naOrBool = (v: unknown) => v === "na" || typeof v === "boolean";

  if (!isCode(raw.from)) e.push(`from: "${raw.from}" is not a valid country code (two uppercase letters)`);
  if (!isCode(raw.to)) e.push(`to: "${raw.to}" is not a valid country code (two uppercase letters)`);
  if (!inSet(SUPPLIES, raw.supply)) e.push(`supply: "${raw.supply}" — must be ${SUPPLIES.join(" / ")}`);
  if (typeof raw.b2b !== "boolean") e.push(`b2b: must be a boolean (true/false)`);
  if (!(raw.serviceKind === "na" || inSet(SERVICE_KINDS, raw.serviceKind)))
    e.push(`serviceKind: "${raw.serviceKind}" — must be ${SERVICE_KINDS.join(" / ")} or na`);
  if (!(raw.onsiteLocation === "na" || inSet(ONSITE_LOCATIONS, raw.onsiteLocation)))
    e.push(`onsiteLocation: "${raw.onsiteLocation}" — must be ${ONSITE_LOCATIONS.join(" / ")} or na`);
  if (!naOrBool(raw.goodsLeave)) e.push(`goodsLeave: must be a boolean or "na"`);
  if (!naOrBool(raw.overThreshold)) e.push(`overThreshold: must be a boolean or "na"`);
  return e;
}

/* ------------------------------------------------------------------
 * LANGUAGE-INDEPENDENT RESULT — the record contains NO human-readable
 * text, only keys. The display layer (i18n dictionary) translates the
 * badge/rule/note keys to the active language; country names come from
 * the country code (Intl.DisplayNames).
 * ------------------------------------------------------------------ */

/** Badge key — in the dictionary: badges.{key}. */
export type Badge =
  | "domestic" | "reverseCharge" | "exportZero" | "outsideEuVat"
  | "importVat" | "destination" | "destinationOss" | "origin"
  | "originLocal" | "onsite";

/** Place of taxation: country code + optional modifier (dictionary: jurisdiction.{mod}). */
export type JurisdictionMod = "state" | "province" | "import" | "importVat";
export interface Jurisdiction {
  country: string;              // country code
  mod: JurisdictionMod | null;
}

/** Note key — in the dictionary: notes.{key}; the view supplies the parameters. */
export interface ComplianceNote {
  tone: "ok" | "warn" | "info";
  key: string;
}

/**
 * A pre-built final result. The app only displays it.
 * `rate` is already the FINAL number (computed by the build-time engine).
 */
export interface ResultRecord {
  /** Deterministic search key, see keyOf(). */
  key: string;
  scenario: ScenarioKey;

  /** Final, applicable rate as a percentage (final number). */
  rate: number;
  /** Place of taxation (country code + modifier — the view turns this into text). */
  jurisdiction: Jurisdiction;

  reverseCharge: boolean;
  oss: boolean;
  exportZero: boolean;
  outsideScope: boolean;
  /** True if the jurisdiction is state-based (US/CA/BR): needs a state rate. */
  needsState: boolean;
  /** Which country's sub-region the rate must come from (when needsState). */
  stateCountry: string | null;

  /** Federal/state breakdown (US/CA/BR), if any. */
  federal: number | null;
  state: number | null;

  /** Rate arising on the buyer's side under reverse charge (or null). */
  buyerRate: number | null;
  /** Buyer's COUNTRY CODE under reverse charge (or null). */
  buyerCountry: string | null;

  /** CODE of the country whose registration threshold is relevant (or null). */
  registrationThreshold: string | null;

  badge: Badge;
  ruleId: string;               // e.g. "S-B2B-EU-EU" — also shown in the UI
  /** Text key for the dictionary (rules.{ruleKey}.name/detail) — the
   *  variant-expanded version of ruleId (e.g. "P-DOM-B2B"). */
  ruleKey: string;
  notes: ComplianceNote[];
}

/** Shape of a per-seller data chunk (data/results/{FROM}.json). */
export interface SellerChunk {
  version: string;
  from: string;
  records: ResultRecord[];
}
