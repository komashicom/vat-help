/* ==================================================================
 *  COUNTRY-SPECIFIC RULES — 🇵🇭 Philippines (PH)
 *  ------------------------------------------------------------------
 *  This file is edited by the PH tax expert (alongside country.json).
 *
 *  The global rule engine (scripts/engine.ts) produces a base record for
 *  every relation pair according to the rulebook. `customize` runs ONLY
 *  for the scenarios where the SELLER = PH, AFTER the global engine.
 *
 *  What it does today: attaches the national 0% invoice code.
 *  ONE source of truth — country.json holds the codes and their English
 *  labels (reducedCategories, rate 0, `type`); this file only says WHICH
 *  code belongs to WHICH relation. The label is looked up, never copied.
 *
 *  Codes in the catalogue but missing from the map below depend on the
 *  seller's status or on what is being sold, not on the relation — the
 *  calculator never asks, so they are deliberately never attached.
 * ================================================================== */
import type { Country } from "../../src/schema/country";
import type { ScenarioKey, ResultRecord } from "../../src/schema/result";


/** ruleId → the national code that goes on the invoice line. */
const BY_RULE: Record<string, string> = {
  "S-B2B-3-X": "zero-rated",    // service export by a non-EU seller
};

export function customize(
  record: ResultRecord,
  _key: ScenarioKey,
  countries: Country[],
): ResultRecord {
  if (record.rate !== 0) return record;
  const code = BY_RULE[record.ruleId];
  if (!code) return record;
  const own = countries.find((c) => c.code === "PH");
  const label = own?.reducedCategories?.find((r) => r.rate === 0)?.type?.[code];
  if (!label) return record;   // not in the country.json catalogue — attach nothing
  return { ...record, invoiceCode: { code, label } };
}
