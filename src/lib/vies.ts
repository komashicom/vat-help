/* ==================================================================
 *  VIES — real VAT-ID verification via the EU's official REST API.
 *  https://ec.europa.eu/taxation_customs/vies/rest-api/
 *
 *  Only meaningful for an EU VAT ID. Runs from the browser: if the
 *  network or CORS blocks it, we throw — the UI shows "unavailable",
 *  and the format check (lib/vat.ts) remains the only fallback signal.
 * ================================================================== */

export interface ViesResult {
  valid: boolean;
  /** The company name on file in VIES, if the member state provides it. */
  name?: string;
  address?: string;
}

/**
 * Expects the full (prefixed, cleaned) VAT ID, e.g. "DE123456789".
 * VIES handles Greek numbers with the "EL" prefix — we take the prefix
 * from the entered number itself, so this works out automatically.
 */
export async function checkVies(vatId: string): Promise<ViesResult> {
  const cc = vatId.slice(0, 2);
  const num = vatId.slice(2);
  if (!/^[A-Z]{2}$/.test(cc) || num.length === 0) throw new Error("Incomplete VAT ID.");

  const res = await fetch(
    `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${cc}/vat/${encodeURIComponent(num)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`VIES HTTP ${res.status}`);

  const data = (await res.json()) as {
    isValid?: boolean;
    userError?: string;
    name?: string;
    address?: string;
  };

  // A userError of "VALID"/"INVALID" is the normal response; anything else is
  // an actual error (e.g. MS_UNAVAILABLE — the member state's database is
  // temporarily unavailable).
  if (data.userError && data.userError !== "VALID" && data.userError !== "INVALID") {
    throw new Error(data.userError);
  }

  const clean = (v?: string) => (v && v.trim() !== "---" ? v.trim() : undefined);
  return { valid: data.isValid === true, name: clean(data.name), address: clean(data.address) };
}
