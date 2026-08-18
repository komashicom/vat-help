import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Building2, User, UserX, Package, Home, Wrench, Store, MapPin, Loader2,
  ArrowRight, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Pencil,
  Globe, Github,
} from "lucide-react";
import type { Supply, ServiceKind, OnsiteLocation, ScenarioKey, ResultRecord } from "../schema/result";
import type { Country } from "../schema/country";
import { byCode } from "../data/countries";
import { detectCountry } from "../lib/locale";
import { isOverEuThreshold } from "../lib/threshold";
import { lookup, preloadResults } from "../search/lookup";
import { checkVatId, cleanVatId } from "../search/validate";
import { checkVies, type ViesResult } from "../lib/vies";
import { defaultCurrency, editCountryUrl, REPO_URL } from "../ui/constants";
import { countryName } from "../ui/format";
import { CountrySelect } from "../ui/CountrySelect";
import { LanguageSelect } from "../ui/LanguageSelect";
import { ResultView } from "../ui/ResultView";
import { ChoiceCard, Hint } from "../ui/components";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BuyerType = "vat" | "novat" | "individual";

interface WizState {
  from: string;
  /** "" = no buyer selected yet — picking one advances the flow. */
  to: string;
  supply: Supply | null;
  buyerType: BuyerType | null;
  serviceKind: ServiceKind;
  goodsLeave: boolean;
  onsiteLocation: OnsiteLocation;
  amount: string;
  currency: string;
  /** The seller's / buyer's country's state-province (US/CA/BR) — stored
   *  separately per country so switching one side's country doesn't lose the
   *  other side's selection. */
  stateFrom: string;
  stateTo: string;
  vatId: string;
}

/** Initial state: the seller is the country from the browser's locale; no buyer yet. */
function makeInitial(): WizState {
  const from = detectCountry();
  return {
    from, to: "",
    supply: null, buyerType: null, serviceKind: "digital",
    goodsLeave: true, onsiteLocation: "seller",
    amount: "1000", currency: defaultCurrency(from), stateFrom: "", stateTo: "", vatId: "",
  };
}

function toScenario(s: WizState): ScenarioKey {
  return {
    from: s.from, to: s.to, supply: s.supply!,
    b2b: s.buyerType === "vat",
    serviceKind: s.supply === "service" ? s.serviceKind : "na",
    goodsLeave: s.supply === "product" ? s.goodsLeave : "na",
    // Not a toggle: we estimate it from the entered amount.
    overThreshold: isOverEuThreshold(parseFloat(s.amount) || 0, s.currency),
    onsiteLocation: s.supply === "service" && s.serviceKind === "onsite" ? s.onsiteLocation : "na",
  };
}

type ViesState =
  | { status: "idle" | "loading" | "error" }
  | { status: "done"; result: ViesResult };

/* ------------------------------------------------------------------
 * "Whose VAT applies" — shown ON each option in the What-are-you-selling
 * popup (like the B2B/B2C badge on the buyer options). Both a short chip on
 * the title row and a line at the bottom: which country the VAT lands in.
 * Computed live from the pre-built record for the CURRENT seller/buyer/
 * B2B-B2C scenario — so e.g. "Digital → Seller VAT" for a B2C sale below the
 * threshold, but "Reverse charge" once the buyer is a VAT-registered business.
 * ------------------------------------------------------------------ */
type SupplyOpt = {
  id: string; supply: Supply; serviceKind?: ServiceKind; goodsLeave?: boolean; onsiteLocation?: OnsiteLocation;
};

/** The options the popup shows for the current relation (cross-border splits
 *  goods into leave/stay and on-site into seller/buyer). */
function supplyOptionsFor(crossBorder: boolean): SupplyOpt[] {
  const goods: SupplyOpt[] = crossBorder
    ? [{ id: "product-leave", supply: "product", goodsLeave: true },
       { id: "product-stay", supply: "product", goodsLeave: false }]
    : [{ id: "product", supply: "product", goodsLeave: true }];
  const onsite: SupplyOpt[] = crossBorder
    ? [{ id: "onsite-seller", supply: "service", serviceKind: "onsite", onsiteLocation: "seller" },
       { id: "onsite-customer", supply: "service", serviceKind: "onsite", onsiteLocation: "customer" }]
    : [{ id: "onsite", supply: "service", serviceKind: "onsite", onsiteLocation: "seller" }];
  return [
    ...goods,
    { id: "digital", supply: "service", serviceKind: "digital" },
    { id: "general", supply: "service", serviceKind: "general" },
    ...onsite,
  ];
}

/** Build the full scenario key for one supply option, reusing the current
 *  seller/buyer/buyer-type and the estimated threshold. */
function optScenario(s: WizState, o: SupplyOpt, over: boolean): ScenarioKey {
  return {
    from: s.from, to: s.to, supply: o.supply,
    b2b: s.buyerType === "vat",
    serviceKind: o.supply === "service" ? (o.serviceKind ?? "general") : "na",
    goodsLeave: o.supply === "product" ? (o.goodsLeave ?? true) : "na",
    overThreshold: over,
    onsiteLocation: o.supply === "service" && o.serviceKind === "onsite" ? (o.onsiteLocation ?? "seller") : "na",
  };
}

const chipAmber = "inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700";
const chipNeutral = "inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground";

/** Flag + localized country name, e.g. "🇭🇺 Hungary". */
function flagged(code: string): string {
  return `${byCode(code)?.flag ?? ""} ${countryName(code)}`.trim();
}

/** From a finished record, derive the whose-VAT chip + bottom line. */
function supplyVat(rec: ResultRecord, t: TFunction): { tag: ReactNode; footer: ReactNode } {
  const line = (text: ReactNode) => <span className="text-[11px] leading-relaxed text-muted-foreground">{text}</span>;
  const strong = (code: string) => <span className="font-semibold text-foreground">{flagged(code)}</span>;

  // Reverse charge / export / outside-scope: the seller invoices 0%.
  if (rec.reverseCharge)
    return { tag: <span className={chipAmber}>{t("supplyVat.rcTag")}</span>, footer: line(t("supplyVat.rcLine")) };
  if (rec.exportZero)
    return { tag: <span className={chipAmber}>{t("supplyVat.exportTag")}</span>, footer: line(<>{t("supplyVat.exportLine")} {strong(rec.scenario.to)}</>) };
  if (rec.outsideScope)
    return {
      tag: <span className={chipAmber}>{t("supplyVat.outsideTag")}</span>,
      footer: line(rec.badge === "outsideEuVat" ? t("supplyVat.outsideEuLine") : <>{t("supplyVat.noTaxLine")} {strong(rec.scenario.to)}</>),
    };

  // Normal case: the VAT is calculated in the jurisdiction country (the
  // seller's or the buyer's — always one of the two).
  const juris = rec.jurisdiction.country;
  const seller = juris === rec.scenario.from;
  return {
    tag: <span className={chipNeutral}>{t(seller ? "supplyVat.sellerTag" : "supplyVat.buyerTag")}</span>,
    footer: line(<>{t("supplyVat.calcLine")} {strong(juris)}</>),
  };
}

export function Wizard() {
  const { t } = useTranslation();
  const [s, setS] = useState<WizState>(makeInitial);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  /** WHAT popup: on a phone the full six-option list needs scrolling, so we
   *  open on the two service options people reach for most and keep the rest
   *  (goods, on-site) behind "more options". Desktop always shows everything —
   *  the gate is pure CSS (`hidden sm:block`), see `moreOnly`. */
  const [showAllSupply, setShowAllSupply] = useState(false);
  const [rec, setRec] = useState<ResultRecord | null>(null);
  /** Per-option records for the What-are-you-selling popup (whose-VAT chips). */
  const [optRecs, setOptRecs] = useState<Record<string, ResultRecord>>({});
  const [vies, setVies] = useState<ViesState>({ status: "idle" });
  const set = (d: Partial<WizState>) => setS((x) => ({ ...x, ...d }));

  // Preload: by the time the user gets through, the index is ready and lookup is instant.
  useEffect(() => { preloadResults(); }, []);

  // The currency follows the seller's country — they typically issue the invoice.
  useEffect(() => { set({ currency: defaultCurrency(s.from) }); }, [s.from]);

  // A different VAT ID / buyer country invalidates the previous VIES result.
  useEffect(() => { setVies({ status: "idle" }); }, [s.vatId, s.to]);

  const ready = Boolean(s.to && s.buyerType && s.supply);
  const overThreshold = isOverEuThreshold(parseFloat(s.amount) || 0, s.currency);

  useEffect(() => {
    if (!ready) { setRec(null); return; }
    let live = true;
    lookup(toScenario(s)).then((r) => { if (live) setRec(r); });
    return () => { live = false; };
  }, [ready, s.from, s.to, s.supply, s.buyerType, s.serviceKind, s.goodsLeave, overThreshold, s.onsiteLocation]);

  const p = byCode(s.from), c = s.to ? byCode(s.to) : undefined;
  const fromName = countryName(s.from), toName = s.to ? countryName(s.to) : "";
  /* On-site labels show flag + country name together: "(🇦🇹 Austria)" */
  const fromFlagged = `${p?.flag ?? ""} ${fromName}`.trim();
  const toFlagged = `${c?.flag ?? ""} ${toName}`.trim();
  const vat = s.buyerType === "vat" && s.to ? checkVatId(s.to, s.vatId) : { ok: true, error: null as null };
  const vatMsg = vat.error ? t(`vatCheck.${vat.error}`, { country: toName, sample: vat.sample }) : "";
  const crossBorder = Boolean(s.to && s.from !== s.to);

  /* Whose-VAT chips: look up every supply option's record for the current
   * scenario, so each option in the popup can show where its VAT lands.
   * The index is preloaded, so these resolve instantly. */
  useEffect(() => {
    if (!s.to || !s.buyerType) { setOptRecs({}); return; }
    let live = true;
    const opts = supplyOptionsFor(crossBorder);
    Promise.all(opts.map((o) => lookup(optScenario(s, o, overThreshold)).then((r) => [o.id, r] as const)))
      .then((entries) => {
        if (live) setOptRecs(Object.fromEntries(entries.filter((e): e is [string, ResultRecord] => e[1] != null)));
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.from, s.to, s.buyerType, crossBorder, overThreshold]);

  /* State-taxed country (US/CA/BR): ask for the state RIGHT AFTER the country
   * is picked, show it below the country, and don't forget it — the next step
   * (To whom?) only comes once the state(s) are set.
   * (AU has sub-regions too, but GST is nationwide — we don't ask there.) */
  const needsStateInput = (code: string): boolean => {
    const cc = code ? byCode(code) : undefined;
    return Boolean(cc?.subRegions?.length) && (cc!.system === "us" || cc!.system === "ca" || cc!.system === "br");
  };
  const fromNeedsState = needsStateInput(s.from);
  const toNeedsState = Boolean(s.to && s.to !== s.from) && needsStateInput(s.to);
  const statesOk = (!fromNeedsState || Boolean(s.stateFrom)) && (!toNeedsState || Boolean(s.stateTo));

  // The calculation needs the state of whichever country the record says decides.
  const activeStateCode = rec?.stateCountry
    ? (rec.stateCountry === s.from ? s.stateFrom : rec.stateCountry === s.to ? s.stateTo : "")
    : "";

  /* Auto-advance to "To whom?": after buyer country + (if needed) states. */
  const maybeOpenBuyer = (next: Partial<WizState>) => {
    const n = { ...s, ...next };
    const fN = needsStateInput(n.from);
    const tN = Boolean(n.to && n.to !== n.from) && needsStateInput(n.to);
    const ok = (!fN || Boolean(n.stateFrom)) && (!tN || Boolean(n.stateTo));
    if (n.to && ok && !n.buyerType) setBuyerOpen(true);
  };
  const pickBuyerCountry = (code: string) => {
    const d = { to: code, stateTo: "" };
    set(d); maybeOpenBuyer(d);
  };
  const pickFrom = (code: string) => set({ from: code, stateFrom: "" });
  const pickStateFrom = (v: string) => { const d = { stateFrom: v }; set(d); maybeOpenBuyer(d); };
  const pickStateTo = (v: string) => { const d = { stateTo: v }; set(d); maybeOpenBuyer(d); };

  /* In the popups a click both SELECTS and CLOSES — no separate X / OK button. */
  const pickBuyerType = (b: BuyerType) => { set({ buyerType: b }); setBuyerOpen(false); };
  const pickSupply = (d: Partial<WizState>) => { set(d); setSupplyOpen(false); };

  /* Digital + general are the two options that stay visible while collapsed.
   * Any other current selection forces the popup open in full — otherwise
   * reopening it would hide the very choice the user already made. */
  const supplyShortlisted = s.supply === "service" && (s.serviceKind === "digital" || s.serviceKind === "general");
  const openSupply = () => {
    setShowAllSupply(Boolean(s.supply) && !supplyShortlisted);
    setSupplyOpen(true);
  };
  /** Collapsed → mobile-only hide. On sm+ every option is always shown. */
  const moreOnly = showAllSupply ? undefined : "hidden sm:block";

  const restart = () => {
    setS(makeInitial());
    setRec(null);
    setVies({ status: "idle" });
    setBuyerOpen(false);
    setSupplyOpen(false);
    setShowAllSupply(false);
  };

  const runVies = async () => {
    setVies({ status: "loading" });
    try {
      setVies({ status: "done", result: await checkVies(cleanVatId(s.vatId)) });
    } catch {
      setVies({ status: "error" });
    }
  };

  /* The picker button's label reflects the selection:
   * "Goods — leaves the country" / "Service — Digital" /
   * "On-site — at the buyer's (Austria)" */
  const supplyLabel = !s.supply
    ? t("wizard.choose")
    : s.supply === "product"
      ? (crossBorder
          ? t(s.goodsLeave ? "wizard.goodsLeaveTitle" : "wizard.goodsStayTitle")
          : t("wizard.supplyProduct"))
      : s.serviceKind === "onsite"
        ? (crossBorder
            ? t(s.onsiteLocation === "customer" ? "wizard.onsiteCustomer" : "wizard.onsiteSeller",
                { country: s.onsiteLocation === "customer" ? toFlagged : fromFlagged })
            : `${t("wizard.supplyService")} — ${t("service.onsite.title")}`)
        : `${t("wizard.supplyService")} — ${t(`service.${s.serviceKind}.title`)}`;

  /* Whose-VAT chip + bottom line for a given supply option (undefined until
   * the record is looked up). */
  const ind = (id: string) => (optRecs[id] ? supplyVat(optRecs[id], t) : undefined);

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-2xl">
      {/* white card — header + calculator + footer */}
      <div className="flex min-h-[100dvh] flex-col bg-background shadow-sm sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-xl">
        {/* On mobile the three header items don't fit side by side, so the repo
            pill shrinks to its bare icon and the title is allowed to go narrow. */}
        <header className="flex items-center gap-2 px-4 py-3.5 sm:gap-2.5 sm:px-5 sm:py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe className="h-5 w-5" />
          </span>
          <h1 className="min-w-0 text-sm font-bold leading-tight tracking-tight text-foreground">{t("app.title")}</h1>
          {/* language switcher — sits right of the title, before the repo pill */}
          <div className="ml-auto shrink-0">
            <LanguageSelect />
          </div>
          {/* open source presence: "OPEN SOURCE" pill linking to the repo
              (icon only below sm — the label wraps to two lines otherwise) */}
          <a href={REPO_URL} target="_blank" rel="noreferrer" title={t("app.openSource")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-2.5">
            <Github className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{t("app.openSource")}</span>
          </a>
        </header>
        <div className="flex flex-col px-4 pb-8 pt-2 sm:px-5">
          {/* 1. seller → buyer (the rates sit below the countries, hence top alignment).
              min-w-0 is required, otherwise long country names push the columns
              wider than the screen (horizontal overflow on mobile).
              Below sm the two columns STACK: at ~390px a half-width column is
              barely 170px, which truncates country names ("Egyesült Ara…"), the
              buyer-type button and the VAT-ID field. Full width fixes all of
              those at once; the arrow just turns to point down. */}
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="min-w-0 space-y-1.5">
              <PanelLabel>{t("wizard.seller")} <Hint text={t("wizard.sellerHint")} /></PanelLabel>
              <CountrySelect value={s.from} onChange={pickFrom} />
              {fromNeedsState && (
                <StateSelect country={byCode(s.from)!} value={s.stateFrom}
                  onChange={pickStateFrom} required={!s.stateFrom}
                  placeholder={t("result.statePlaceholder")} />
              )}
            </div>
            <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground sm:mt-9 sm:rotate-0" />
            <div className="min-w-0 space-y-1.5">
              <PanelLabel>{t("wizard.buyer")} <Hint text={t("wizard.buyerHint")} /></PanelLabel>
              <CountrySelect value={s.to} onChange={pickBuyerCountry} placeholder={t("wizard.chooseBuyer")} />
              {toNeedsState && (
                <StateSelect country={byCode(s.to)!} value={s.stateTo}
                  onChange={pickStateTo} required={!s.stateTo}
                  placeholder={t("result.statePlaceholder")} />
              )}
              {/* buyer type — right below the buyer's country so they read as one unit */}
              {s.to && statesOk && (
                <button onClick={() => setBuyerOpen(true)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition hover:bg-accent active:scale-[0.99] sm:gap-2 sm:px-3",
                    // once selected: borderless — only the chevron hints it can be reopened
                    s.buyerType ? "border-transparent" : "border-dashed border-primary/60 bg-primary/5",
                  )}>
                  <span className={cn("min-w-0 truncate text-sm font-semibold", s.buyerType ? "text-foreground" : "text-primary")}>
                    {s.buyerType ? t(`buyer.${s.buyerType}`) : t("wizard.choose")}
                  </span>
                  {s.buyerType && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {s.buyerType === "vat" ? "B2B" : s.buyerType === "novat" ? <B2BWarnBadge /> : "B2C"}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}
              {/* VAT ID + VIES — in the buyer column, below the buyer type (it belongs there);
                  an empty field shows no error message / status at all */}
              {s.to && statesOk && s.buyerType === "vat" && (
                <div className="space-y-1.5 pt-1">
                  <PanelLabel className="justify-start px-0 text-left">
                    {t("wizard.vatIdLabel", { country: toName })} <Hint text={t("wizard.vatIdHint")} />
                  </PanelLabel>
                  <div className="flex items-center gap-2">
                    <Input value={s.vatId} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      aria-invalid={Boolean(s.vatId && !vat.ok)}
                      onChange={(e) => set({ vatId: e.target.value })}
                      onBlur={(e) => set({ vatId: cleanVatId(e.target.value) })}
                      placeholder={c?.vatPattern ? `${c.code}…` : t("wizard.vatIdPlaceholder")}
                      className="mono h-10 min-w-0 bg-background" />
                    {c?.eu && (
                      <button type="button" onClick={runVies} disabled={!s.vatId || !vat.ok || vies.status === "loading"}
                        className="shrink-0 text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80 disabled:pointer-events-none disabled:opacity-50">
                        {vies.status === "loading"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : t("wizard.viesButton")}
                      </button>
                    )}
                  </div>
                  {s.vatId && !vat.ok && (
                    <p className="text-xs leading-relaxed text-destructive">{vatMsg}</p>
                  )}
                  {vies.status === "done" && (vies.result.valid ? (
                    <p className="inline-flex items-start gap-1 text-xs text-green-600">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t("wizard.viesValid")}{vies.result.name ? <> {t("wizard.viesRegisteredName")} <strong>{vies.result.name}</strong></> : null}</span>
                    </p>
                  ) : (
                    <p className="inline-flex items-start gap-1 text-xs text-destructive">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t("wizard.viesInvalid")}</span>
                    </p>
                  ))}
                  {vies.status === "error" && (
                    <p className="inline-flex items-start gap-1 text-xs text-amber-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t("wizard.viesError")}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. What? — a SINGLE picker button, the popup brings all the options */}
          <div className="mx-auto mt-6 w-full max-w-sm space-y-6">
            {s.buyerType && (
              <div className="space-y-1.5">
                <PanelLabel>{t("wizard.what")} <Hint text={t("steps.supply.hint")} /></PanelLabel>
                <button onClick={openSupply}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 transition hover:bg-accent active:scale-[0.99]",
                    // once selected: borderless — only the chevron hints it can be reopened
                    s.supply ? "border-transparent" : "border-dashed border-primary/60 bg-primary/5",
                  )}>
                  <span className={cn("min-w-0 truncate text-sm font-semibold", s.supply ? "text-foreground" : "text-primary")}>
                    {supplyLabel}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>

          {/* TO WHOM popup — a click selects AND closes; no X or OK button */}
          <Dialog open={buyerOpen} onOpenChange={setBuyerOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
              <DialogHeader>
                <DialogTitle className="text-center">{t("wizard.toWhom")}</DialogTitle>
                <DialogDescription className="sr-only">{t("steps.buyer_type.subtitle")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <ChoiceCard active={s.buyerType === "vat"} onClick={() => pickBuyerType("vat")}
                  icon={<Building2 className="h-5 w-5" />} title={t("buyer.vat")} badge="B2B"
                  hint={t("wizard.buyerVatHint")} />
                <ChoiceCard active={s.buyerType === "novat"} onClick={() => pickBuyerType("novat")}
                  icon={<UserX className="h-5 w-5" />} title={t("buyer.novat")} badge={<B2BWarnBadge />}
                  hint={t("wizard.buyerNovatHint")} />
                <ChoiceCard active={s.buyerType === "individual"} onClick={() => pickBuyerType("individual")}
                  icon={<User className="h-5 w-5" />} title={t("buyer.individual")} badge="B2C"
                  hint={t("wizard.buyerIndividualHint")} />
              </div>
            </DialogContent>
          </Dialog>

          {/* WHAT popup — goods + services in ONE list with section headers;
              a click selects AND closes; no X or OK button */}
          <Dialog open={supplyOpen} onOpenChange={setSupplyOpen}>
            {/* wider than the buyer popup: on-site titles carry a country name
                ("On-site — at the buyer (🇦🇪 United Arab Emirates)") plus a tag */}
            <DialogContent className="sm:max-w-lg" showCloseButton={false}>
              <DialogHeader>
                <DialogTitle className="text-center">{t("wizard.what")}</DialogTitle>
                <DialogDescription className="sr-only">{t("steps.supply.hint")}</DialogDescription>
              </DialogHeader>
              {/* The DOM order is always the full list; while collapsed the
                  phone simply hides everything but digital + general. */}
              <div className="space-y-2">
                <SectionLabel className={moreOnly}>{t("wizard.sectionGoods")}</SectionLabel>
                {crossBorder ? (
                  <>
                    <ChoiceCard className={moreOnly} active={s.supply === "product" && s.goodsLeave}
                      onClick={() => pickSupply({ supply: "product", goodsLeave: true })}
                      icon={<Package className="h-5 w-5" />} title={t("wizard.goodsLeaveTitle")}
                      desc={t("wizard.goodsLeaveDesc")}
                      tag={ind("product-leave")?.tag} footer={ind("product-leave")?.footer} />
                    <ChoiceCard className={moreOnly} active={s.supply === "product" && !s.goodsLeave}
                      onClick={() => pickSupply({ supply: "product", goodsLeave: false })}
                      icon={<Home className="h-5 w-5" />} title={t("wizard.goodsStayTitle")}
                      desc={t("wizard.goodsStayDesc")}
                      tag={ind("product-stay")?.tag} footer={ind("product-stay")?.footer} />
                  </>
                ) : (
                  <ChoiceCard className={moreOnly} active={s.supply === "product"}
                    onClick={() => pickSupply({ supply: "product", goodsLeave: true })}
                    icon={<Package className="h-5 w-5" />} title={t("wizard.supplyProduct")}
                    desc={t("wizard.supplyProductDesc")}
                    tag={ind("product")?.tag} footer={ind("product")?.footer} />
                )}
                <SectionLabel className={cn("pt-2", moreOnly)}>{t("wizard.sectionServices")}</SectionLabel>
                <ChoiceCard active={s.supply === "service" && s.serviceKind === "digital"}
                  onClick={() => pickSupply({ supply: "service", serviceKind: "digital" })}
                  icon={<Store className="h-5 w-5" />} title={t("service.digital.title")}
                  desc={t("service.digital.desc")}
                  hint={`${t("wizard.examplesLabel")} ${t("service.digital.examples")}`}
                  tag={ind("digital")?.tag} footer={ind("digital")?.footer} />
                <ChoiceCard active={s.supply === "service" && s.serviceKind === "general"}
                  onClick={() => pickSupply({ supply: "service", serviceKind: "general" })}
                  icon={<Wrench className="h-5 w-5" />} title={t("service.general.title")}
                  desc={t("service.general.desc")}
                  hint={`${t("wizard.examplesLabel")} ${t("service.general.examples")}`}
                  tag={ind("general")?.tag} footer={ind("general")?.footer} />
                {/* On-site split in two: the place of supply (seller's / buyer's country)
                    IS the choice — no separate radio-button sub-step */}
                {crossBorder ? (
                  <>
                    <ChoiceCard className={moreOnly} active={s.supply === "service" && s.serviceKind === "onsite" && s.onsiteLocation === "seller"}
                      onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "seller" })}
                      icon={<MapPin className="h-5 w-5" />} title={t("wizard.onsiteSeller", { country: fromFlagged })}
                      desc={t("service.onsite.desc")}
                      hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`}
                      tag={ind("onsite-seller")?.tag} footer={ind("onsite-seller")?.footer} />
                    <ChoiceCard className={moreOnly} active={s.supply === "service" && s.serviceKind === "onsite" && s.onsiteLocation === "customer"}
                      onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "customer" })}
                      icon={<MapPin className="h-5 w-5" />} title={t("wizard.onsiteCustomer", { country: toFlagged })}
                      desc={t("service.onsite.desc")}
                      hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`}
                      tag={ind("onsite-customer")?.tag} footer={ind("onsite-customer")?.footer} />
                  </>
                ) : (
                  <ChoiceCard className={moreOnly} active={s.supply === "service" && s.serviceKind === "onsite"}
                    onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "seller" })}
                    icon={<MapPin className="h-5 w-5" />} title={t("service.onsite.title")}
                    desc={t("service.onsite.desc")}
                    hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`}
                    tag={ind("onsite")?.tag} footer={ind("onsite")?.footer} />
                )}
                {/* Phone-only toggle: reveals / hides goods + on-site again.
                    Never shown on sm+, where nothing was hidden to begin with. */}
                <button type="button" onClick={() => setShowAllSupply((v) => !v)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden">
                  {t(showAllSupply ? "wizard.fewerOptions" : "wizard.moreOptions")}
                  {showAllSupply
                    ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* result — appears on its own once every choice is made */}
          {ready && (
            <div className="mt-6">
              {!rec ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> {t("wizard.searching")}
                </div>
              ) : (
                <ResultView rec={rec} amount={s.amount} currency={s.currency}
                  onAmountChange={(v) => set({ amount: v })} onCurrencyChange={(v) => set({ currency: v })}
                  stateCode={activeStateCode} />
              )}
            </div>
          )}

        </div>

        {/* flat footer — no box or border, at the bottom of the card (on mobile
            mt-auto pushes it down to the card's bottom) */}
        <footer className="mt-auto space-y-1 px-5 pb-6 text-center text-xs leading-relaxed text-muted-foreground">
          <p>{t("footer.line1")}</p>
          <p>{t("footer.line2")}</p>
          <p>{t("footer.disclaimer")}</p>
        </footer>
      </div>

      {/* BELOW THE CARD, on the grey background: reset in the middle, flanked by
          the edit links (country.json Gitea editor): seller's country on the left,
          buyer's on the right. The row follows the middle column's width. */}
      {/* Mobile: stack the three items, each centered on its own line, so long
          country names never overflow or collide with Reset. Desktop (sm+): a
          3-column grid with Reset in the centered "auto" column, links flanking.
          Each link is an unbreakable unit so the pencil never orphans.
          The pencil leads BOTH links on mobile (they sit centered under each
          other, so mirroring them would just look misaligned); from sm up the
          buyer's link flips so its pencil points outward, away from Reset. */}
      <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-1.5 px-4 pb-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-4">
        <a href={editCountryUrl(s.from)} target="_blank" rel="noreferrer"
          title={`${t("result.editAria")} — ${fromName}`}
          className="inline-flex max-w-full items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary/80 sm:justify-self-start">
          <Pencil className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate underline underline-offset-2">{fromName.toUpperCase()}</span>
        </a>
        <button type="button" onClick={restart}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground sm:justify-self-center">
          <RotateCcw className="h-3 w-3 shrink-0" /> {t("wizard.restart")}
        </button>
        {s.to && s.to !== s.from ? (
          <a href={editCountryUrl(s.to)} target="_blank" rel="noreferrer"
            title={`${t("result.editAria")} — ${toName}`}
            className="inline-flex max-w-full items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary/80 sm:flex-row-reverse sm:justify-self-end">
            <Pencil className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate underline underline-offset-2">{toName.toUpperCase()}</span>
          </a>
        ) : <span className="hidden sm:block" />}
      </div>
    </div>
  );
}

function PanelLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </div>
  );
}

/** Group header in the WHAT popup's list (Goods / Services). */
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </div>
  );
}

/** Business without a VAT ID: formally B2B, but the ! flags that for VAT we treat it as B2C. */
function B2BWarnBadge() {
  return (
    <span className="inline-flex items-center">
      B2B<span className="ml-0.5 font-bold text-amber-600">!</span>
    </span>
  );
}

/** State/province selector below the country selector (US/CA/BR).
 *  For BR the list shows the COMBINED federal + state rate. */
function StateSelect({ country, value, onChange, required, placeholder }: {
  country: Country; value: string; onChange: (v: string) => void; required: boolean; placeholder: string;
}) {
  const combined = (rate: number) =>
    country.system === "br" ? (country.federal ?? 0) + rate : rate;
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger size="sm"
        className={cn("w-full justify-center text-xs",
          // filled in: borderless; while required and empty, highlighted border
          required ? "border-primary ring-1 ring-primary" : "border-transparent")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(country.subRegions ?? []).map((r) => (
          <SelectItem key={r.code} value={r.code}>{r.name} ({combined(r.rate)}%)</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
