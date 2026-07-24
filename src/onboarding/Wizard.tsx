import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2, User, UserX, Package, Home, Wrench, Store, MapPin, Loader2,
  ArrowRight, ChevronDown, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Pencil,
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

export function Wizard() {
  const { t } = useTranslation();
  const [s, setS] = useState<WizState>(makeInitial);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [rec, setRec] = useState<ResultRecord | null>(null);
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

  const restart = () => {
    setS(makeInitial());
    setRec(null);
    setVies({ status: "idle" });
    setBuyerOpen(false);
    setSupplyOpen(false);
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

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-2xl">
      {/* white card — header + calculator + footer */}
      <div className="flex min-h-[100dvh] flex-col bg-background shadow-sm sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-xl">
        <header className="flex items-center gap-2.5 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe className="h-5 w-5" />
          </span>
          <h1 className="text-sm font-bold leading-tight tracking-tight text-foreground">{t("app.title")}</h1>
          {/* open source presence: "OPEN SOURCE" pill linking to the repo */}
          <a href={REPO_URL} target="_blank" rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Github className="h-3.5 w-3.5" />
            {t("app.openSource")}
          </a>
        </header>
        <div className="flex flex-col px-4 pb-8 pt-2 sm:px-5">
          {/* 1. seller → buyer (the rates sit below the countries, hence top alignment).
              min-w-0 is required, otherwise long country names push the columns
              wider than the screen (horizontal overflow on mobile). */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <div className="min-w-0 space-y-1.5">
              <PanelLabel>{t("wizard.seller")} <Hint text={t("wizard.sellerHint")} /></PanelLabel>
              <CountrySelect value={s.from} onChange={pickFrom} />
              {fromNeedsState && (
                <StateSelect country={byCode(s.from)!} value={s.stateFrom}
                  onChange={pickStateFrom} required={!s.stateFrom}
                  placeholder={t("result.statePlaceholder")} />
              )}
            </div>
            <ArrowRight className="mt-9 h-5 w-5 text-muted-foreground" />
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
                <button onClick={() => setSupplyOpen(true)}
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
                <DialogTitle>{t("wizard.toWhom")}</DialogTitle>
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
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>{t("wizard.what")}</DialogTitle>
                <DialogDescription className="sr-only">{t("steps.supply.hint")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <SectionLabel>{t("wizard.sectionGoods")}</SectionLabel>
                {crossBorder ? (
                  <>
                    <ChoiceCard active={s.supply === "product" && s.goodsLeave}
                      onClick={() => pickSupply({ supply: "product", goodsLeave: true })}
                      icon={<Package className="h-5 w-5" />} title={t("wizard.goodsLeaveTitle")}
                      desc={t("wizard.goodsLeaveDesc")} />
                    <ChoiceCard active={s.supply === "product" && !s.goodsLeave}
                      onClick={() => pickSupply({ supply: "product", goodsLeave: false })}
                      icon={<Home className="h-5 w-5" />} title={t("wizard.goodsStayTitle")}
                      desc={t("wizard.goodsStayDesc")} />
                  </>
                ) : (
                  <ChoiceCard active={s.supply === "product"}
                    onClick={() => pickSupply({ supply: "product", goodsLeave: true })}
                    icon={<Package className="h-5 w-5" />} title={t("wizard.supplyProduct")}
                    desc={t("wizard.supplyProductDesc")} />
                )}
                <SectionLabel className="pt-2">{t("wizard.sectionServices")}</SectionLabel>
                <ChoiceCard active={s.supply === "service" && s.serviceKind === "digital"}
                  onClick={() => pickSupply({ supply: "service", serviceKind: "digital" })}
                  icon={<Store className="h-5 w-5" />} title={t("service.digital.title")}
                  desc={t("service.digital.desc")}
                  hint={`${t("wizard.examplesLabel")} ${t("service.digital.examples")}`} />
                <ChoiceCard active={s.supply === "service" && s.serviceKind === "general"}
                  onClick={() => pickSupply({ supply: "service", serviceKind: "general" })}
                  icon={<Wrench className="h-5 w-5" />} title={t("service.general.title")}
                  desc={t("service.general.desc")}
                  hint={`${t("wizard.examplesLabel")} ${t("service.general.examples")}`} />
                {/* On-site split in two: the place of supply (seller's / buyer's country)
                    IS the choice — no separate radio-button sub-step */}
                {crossBorder ? (
                  <>
                    <ChoiceCard active={s.supply === "service" && s.serviceKind === "onsite" && s.onsiteLocation === "seller"}
                      onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "seller" })}
                      icon={<MapPin className="h-5 w-5" />} title={t("wizard.onsiteSeller", { country: fromFlagged })}
                      desc={t("service.onsite.desc")}
                      hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`} />
                    <ChoiceCard active={s.supply === "service" && s.serviceKind === "onsite" && s.onsiteLocation === "customer"}
                      onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "customer" })}
                      icon={<MapPin className="h-5 w-5" />} title={t("wizard.onsiteCustomer", { country: toFlagged })}
                      desc={t("service.onsite.desc")}
                      hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`} />
                  </>
                ) : (
                  <ChoiceCard active={s.supply === "service" && s.serviceKind === "onsite"}
                    onClick={() => pickSupply({ supply: "service", serviceKind: "onsite", onsiteLocation: "seller" })}
                    icon={<MapPin className="h-5 w-5" />} title={t("service.onsite.title")}
                    desc={t("service.onsite.desc")}
                    hint={`${t("wizard.examplesLabel")} ${t("service.onsite.examples")}`} />
                )}
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
      <div className="mx-auto mt-4 grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-6">
        <a href={editCountryUrl(s.from)} target="_blank" rel="noreferrer"
          title={`${t("result.editAria")} — ${fromName}`}
          className="inline-flex items-center gap-1 justify-self-start text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80">
          <Pencil className="h-3 w-3" /> {fromName.toUpperCase()}
        </a>
        <button type="button" onClick={restart}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground">
          <RotateCcw className="h-3 w-3" /> {t("wizard.restart")}
        </button>
        {s.to && s.to !== s.from ? (
          <a href={editCountryUrl(s.to)} target="_blank" rel="noreferrer"
            title={`${t("result.editAria")} — ${toName}`}
            className="inline-flex items-center gap-1 justify-self-end text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80">
            {toName.toUpperCase()} <Pencil className="h-3 w-3" />
          </a>
        ) : <span />}
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
