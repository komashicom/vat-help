import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Info, ArrowRight, Pencil } from "lucide-react";
import type { ResultRecord, Jurisdiction } from "../schema/result";
import { byCode, CURRENCIES } from "../data/countries";
import { editCountryUrl } from "./constants";
import { calculate } from "../lib/vat";
import { approxEur, EU_THRESHOLD_EUR } from "../lib/threshold";
import { fmtMoney, fmtAmount, fmtPct, countryName } from "./format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Hint } from "./components";
import { cn } from "@/lib/utils";

const toneStyle: Record<string, string> = {
  ok: "border-green-100 bg-green-50 text-green-700",
  warn: "border-amber-100 bg-amber-50 text-amber-700",
  info: "border-border bg-muted/50 text-muted-foreground",
};

export function ResultView({
  rec, amount, currency, onAmountChange, onCurrencyChange, stateCode,
}: {
  rec: ResultRecord;
  amount: string; currency: string;
  onAmountChange: (v: string) => void; onCurrencyChange: (v: string) => void;
  /** State selection happens in the Wizard, below the country — here we just factor it in. */
  stateCode: string;
}) {
  const { t } = useTranslation();
  const p = byCode(rec.scenario.from);
  const stateCountry = rec.stateCountry ? byCode(rec.stateCountry) : undefined;
  const fromName = countryName(rec.scenario.from);
  const toName = countryName(rec.scenario.to);

  const amountNum = parseFloat(amount) || 0;
  // Real-time calculation: calculate() is pure — it reruns on every keystroke.
  const calc = calculate(rec, amountNum, stateCode);
  const { rate, vat, gross } = calc;

  /* Interpolation parameters for the rule texts — built from the country
   * codes, using the active language's country names. */
  const onsiteCode = rec.scenario.onsiteLocation === "customer" ? rec.scenario.to : rec.scenario.from;
  const ruleParams: Record<string, string | number> = {
    from: fromName,
    to: toName,
    loc: countryName(onsiteCode),
    buyerRate: rec.buyerRate ?? "",
  };

  /* The explanation text comes from the TAXING country's country.json (the
   * rules block) — the same file the pencil icon opens for editing. If it's
   * not there, the dictionary is the fallback. We fill in the placeholders
   * here. */
  const fill = (tpl: string) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in ruleParams ? String(ruleParams[k]) : m));
  const ruleOverride = byCode(rec.jurisdiction.country)?.rules?.[rec.ruleKey];
  const ruleName = ruleOverride ? fill(ruleOverride.name) : t(`rules.${rec.ruleKey}.name`, ruleParams);
  const ruleDetail = ruleOverride ? fill(ruleOverride.detail) : t(`rules.${rec.ruleKey}.detail`, ruleParams);

  /* Jurisdiction label: code + modifier → text; for state selections, "State, Country". */
  const jurisdictionLabel = (j: Jurisdiction): string => {
    const name = countryName(j.country);
    return j.mod ? t(`jurisdiction.${j.mod}`, { country: name }) : name;
  };
  const label = calc.subRegion
    ? `${calc.subRegion.name}, ${countryName(calc.jurisdiction.country)}`
    : jurisdictionLabel(calc.jurisdiction);

  /* Registration threshold: the dictionary can override it (en), otherwise country.json. */
  const thresholdCountry = rec.registrationThreshold ? byCode(rec.registrationThreshold) : undefined;
  const thresholdText = thresholdCountry?.threshold
    ? t(`thresholds.${thresholdCountry.code}`, { defaultValue: thresholdCountry.threshold })
    : null;

  /* State-based taxation (US/CA/BR): until a state is picked, the exact rate
   * is unknown — instead of 0% we show the possible RANGE (BR: combined with
   * the federal rate), and we highlight the state picker. */
  const stateRates = (stateCountry?.subRegions ?? []).map((r) =>
    stateCountry?.system === "br" ? (rec.federal ?? 0) + r.rate : r.rate);
  const rateIsRange = calc.stateRequired && stateRates.length > 0;
  const rateDisplay = rateIsRange
    ? `${Math.min(...stateRates)}–${Math.max(...stateRates)}%`
    : fmtPct(rate);

  return (
    <div className="space-y-5">
      {/* rate — centered, in "VAT 27%" form.
          For state-based taxation without a state picked, a range (e.g. "VAT 0–9.4%").
          Below it, centered, the rule ID (e.g. S-B2B-EU-EU). */}
      <div className="text-center">
        <div className={cn("mono font-bold tracking-tight text-foreground", rateIsRange ? "text-4xl" : "text-6xl")}>
          <span className="mr-2 text-2xl font-semibold uppercase text-muted-foreground">VAT</span>{rateDisplay}
        </div>
        <div className="mono mt-1 text-[11px] tracking-wide text-muted-foreground/60">{rec.ruleId}</div>
      </div>

      {/* place of taxation — right below the VAT rate, centered */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("result.taxPlace")}
          <Hint text={t("result.taxPlaceHint")} />
        </div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
      </div>

      {/* live calculation — "Net × VAT = Gross" row: every cell has the label
          on top, the value below it (small currency code + big number), with
          operator signs between cells; the gross cell is in a green box. In
          the Net cell, clicking the currency code switches currency, clicking
          the number lets you edit it. */}
      <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl border bg-card px-3 py-2">
        <div className="flex flex-col gap-0.5 rounded-lg px-1.5 py-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("result.net")}
            <Hint text={t("result.netHint")} />
          </span>
          <div className="flex items-baseline gap-1">
            <Select value={currency} onValueChange={onCurrencyChange}>
              <SelectTrigger size="sm"
                className="mono h-auto gap-0.5 rounded-sm border-0 bg-transparent p-0 text-[11px] font-semibold text-muted-foreground shadow-none [&_svg:not([class*='size-'])]:size-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
            <input value={amount} inputMode="decimal" aria-label={t("result.netAria")}
              style={{ width: `${Math.max(amount.length, 1) + 1}ch` }}
              onChange={(e) => onAmountChange(e.target.value.replace(/[^\d.]/g, ""))}
              className="mono cursor-text rounded-sm bg-transparent text-lg font-semibold text-foreground outline-none focus:bg-primary/5 sm:text-xl" />
          </div>
        </div>
        <Op>×</Op>
        {/* the rate is shown next to the VAT label too: "VAT 20%" */}
        <Stat label={`${t("result.vat")} ${rateDisplay}`} hint={t("result.vatHint")}
          currency={calc.stateRequired ? "" : currency}
          value={calc.stateRequired ? "—" : fmtAmount(vat, currency)} />
        <Op>=</Op>
        <Stat label={t("result.gross")} hint={t("result.grossHint")} accent
          currency={calc.stateRequired ? "" : currency}
          value={calc.stateRequired ? "—" : fmtAmount(gross, currency)} />
      </div>

      {/* law-adjacent explanation — below a faint divider line, with its own
          heading; on the right, the pencil with the TAXING country's name
          (opens that country's country.json in Gitea's web editor — saving
          auto-creates a PR), so it's clear whose data you're editing */}
      <div className="border-t border-border/70 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">{t("result.explanation")}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{ruleName}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ruleDetail}</p>
          </div>
          <a href={editCountryUrl(rec.jurisdiction.country)} target="_blank" rel="noreferrer"
            aria-label={`${t("result.editAria")} — ${countryName(rec.jurisdiction.country)}`}
            title={`${t("result.editAria")} — ${countryName(rec.jurisdiction.country)}`}
            className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground/60 transition-colors hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
            {countryName(rec.jurisdiction.country)}
          </a>
        </div>
      </div>

      {/* registration threshold */}
      {thresholdText && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
          <div className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-700/70">
            {t("result.regThreshold")}
            <Hint text={t("result.regThresholdHint")} className="text-amber-700/60" />
          </div>
          <div className="text-sm font-semibold text-amber-700">{thresholdText}</div>
        </div>
      )}

      {/* reverse-charge strip */}
      {rec.buyerRate != null && (
        <div className="rounded-xl bg-primary/5 p-4">
          <div className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("result.rcTitle")}
            <Hint text={t("result.rcHint")} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{t("result.youInvoice")}</div>
              <div className="mono text-sm font-semibold text-foreground">0%</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="rounded-lg border border-primary/30 bg-card px-3 py-2">
              <div className="text-[11px] text-muted-foreground">
                {t("result.buyerSelf", { country: `${byCode(rec.buyerCountry ?? "")?.flag ?? ""} ${rec.buyerCountry ?? ""}` })}
              </div>
              <div className="mono text-sm font-semibold text-primary">{rec.buyerRate}% · ≈ {fmtMoney(calc.buyerVat ?? 0, currency)}</div>
            </div>
          </div>
          {p?.eu && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t("result.viesZeroWarning")}</span>
            </div>
          )}
        </div>
      )}

      {/* EU threshold — estimated from the entered amount */}
      {rec.scenario.overThreshold !== "na" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {t("result.amountEntered", { amount: `${currency !== "EUR" ? "≈ " : ""}${fmtMoney(approxEur(amountNum, currency), "EUR")}` })}{" "}
            <strong>{rec.scenario.overThreshold
              ? t("result.thresholdOver", { limit: fmtMoney(EU_THRESHOLD_EUR, "EUR") })
              : t("result.thresholdUnder", { limit: fmtMoney(EU_THRESHOLD_EUR, "EUR") })}</strong>
            {" "}{t("result.thresholdCaveat", { approx: currency !== "EUR" ? t("result.thresholdApprox") : "" })}
          </span>
        </div>
      )}

      {/* notes — the state-selection warning row only shows while a state genuinely hasn't been picked */}
      {rec.notes.length > 0 && (
        <div className="space-y-2">
          {rec.notes.filter((n) => n.key !== "pickState" || calc.stateRequired).map((n, i) => (
            <div key={i} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", toneStyle[n.tone])}>
              {n.tone === "ok" ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : n.tone === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{t(`notes.${n.key}`, ruleParams)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One cell in the "Net × VAT = Gross" row — label on top, value below it:
 *  small currency code + big number; the gross cell (accent) gets a green box. */
function Stat({ label, currency, value, accent, hint }: {
  label: string; currency?: string; value: string; accent?: boolean; hint?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg px-1.5 py-1", accent && "bg-green-50/60")}>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <div className="flex items-baseline gap-1">
        {currency && <span className="mono text-[11px] font-semibold text-muted-foreground">{currency}</span>}
        <span className={cn("mono text-lg font-semibold sm:text-xl", accent ? "text-green-700" : "text-foreground")}>{value}</span>
      </div>
    </div>
  );
}

/** Operator sign between cells (× / =) — aligned to the value row's height. */
function Op({ children }: { children: string }) {
  return <span className="mono pt-3 text-base font-medium text-muted-foreground">{children}</span>;
}
