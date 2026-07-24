import type { ScenarioKey } from "../schema/result";
import { byCode } from "../data/countries";

/**
 * Sets non-relevant degrees of freedom to "na", so the generator and the
 * app build the EXACT SAME key. (E.g. a product has no serviceKind.)
 */
export function normalizeKey(raw: ScenarioKey): ScenarioKey {
  const domestic = raw.from === raw.to;
  /* The €10,000 EU distance-selling/OSS threshold is only a degree of
   * freedom for transactions WITHIN the EU — for every other relation it
   * stays "na", so no threshold info attaches to the record, and the UI
   * doesn't show an EU threshold warning either. */
  const bothEu = Boolean(byCode(raw.from)?.eu && byCode(raw.to)?.eu);
  const k: ScenarioKey = {
    from: raw.from, to: raw.to, supply: raw.supply, b2b: raw.b2b,
    serviceKind: "na", goodsLeave: "na", overThreshold: "na", onsiteLocation: "na",
  };
  if (raw.supply === "product") {
    if (!domestic) {
      // goodsLeave matters for B2C too: if the goods don't leave the
      // country (local purchase), the threshold question is irrelevant.
      k.goodsLeave = raw.goodsLeave === "na" ? true : raw.goodsLeave;
      if (!raw.b2b && k.goodsLeave === true && bothEu) {
        k.overThreshold = raw.overThreshold === "na" ? true : raw.overThreshold;
      }
    }
  } else {
    k.serviceKind = raw.serviceKind === "na" ? "digital" : raw.serviceKind;
    if (k.serviceKind === "onsite") {
      k.onsiteLocation = raw.onsiteLocation === "na" ? "seller" : raw.onsiteLocation;
    } else if (k.serviceKind === "digital" && !raw.b2b && !domestic && bothEu) {
      k.overThreshold = raw.overThreshold === "na" ? true : raw.overThreshold;
    }
  }
  return k;
}

/** Deterministic, stable search key. The field order is fixed. */
export function keyOf(s: ScenarioKey): string {
  return [
    s.from, s.to, s.supply,
    s.b2b ? "b2b" : "b2c",
    s.serviceKind,
    s.goodsLeave === "na" ? "na" : s.goodsLeave ? "leave" : "stay",
    s.overThreshold === "na" ? "na" : s.overThreshold ? "over" : "under",
    s.onsiteLocation,
  ].join("|");
}
