/* ==================================================================
 *  COUNTRY-SPECIFIC RULES — 🇵🇭 Philippines (PH)
 *  ------------------------------------------------------------------
 *  This file is edited by the PH tax expert (alongside country.json).
 *
 *  The global rule engine (scripts/engine.ts) produces a base record
 *  for every relation pair according to the rulebook. The `customize`
 *  function here runs ONLY for the scenarios where the SELLER = PH,
 *  and lets you override the global result with a PH-specific
 *  deviation (e.g. a local exemption, a special threshold, a note
 *  pushed into the `notes` array).
 *
 *  If there is no PH-specific deviation, leave the function unchanged.
 * ================================================================== */
import type { Country } from "../../src/schema/country";
import type { ScenarioKey, ResultRecord } from "../../src/schema/result";

export function customize(
  record: ResultRecord,
  _key: ScenarioKey,
  _countries: Country[],
): ResultRecord {
  return record;
}
