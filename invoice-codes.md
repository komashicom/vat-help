# Invoice exemption codes — the global picture

When the engine returns `rate: 0`, the seller's invoice almost always needs a
**reason** next to the zero. How that reason must be expressed splits the world
into three tiers. Only tier 1 is derivable from a `ScenarioKey`.

Hungary's own code list (AAM, TAM, KBAET, EUFAD37…) is documented separately in
`countries/HU/nav-codes.md` — it is one instance of tier 2.

---

## Tier 1 — EN 16931: the common European layer

Every EU member state's e-invoice, plus Peppol worldwide, carries a **VAT
category code** (BT-118 / BT-151, from UNTDID 5305) and optionally a **VAT
exemption reason code** (BT-121, from the VATEX code list). This is the only
coding scheme that is (a) the same everywhere and (b) fully determined by the
relation the engine already models.

### VAT category codes (UNTDID 5305 subset)

| Code | Meaning | Rate |
|---|---|---|
| `S` | Standard rate (includes reduced rates) | > 0 |
| `Z` | Zero rated goods | 0 |
| `E` | Exempt from tax | 0 |
| `AE` | VAT reverse charge | 0 |
| `K` | Intra-Community supply of goods and services (EEA) | 0 |
| `G` | Free export item, VAT not charged | 0 |
| `O` | Services outside scope of tax | 0 |
| `L` | Canary Islands IGIC | — |
| `M` | Ceuta & Melilla IPSI | — |

`E`, `AE`, `G`, `K`, `O` all mean 0 but are **not** interchangeable — the EN
16931 business rules (BR-E-*, BR-AE-*, BR-G-*, BR-IC-*, BR-O-*) each require a
matching exemption reason and reject the wrong combination.

### VATEX exemption reason codes (BT-121)

| Code | Use with | Meaning |
|---|---|---|
| `VATEX-EU-AE` | `AE` | Reverse charge |
| `VATEX-EU-IC` | `K` | Intra-Community supply |
| `VATEX-EU-G` | `G` | Export outside the EU |
| `VATEX-EU-O` | `O` | Not subject to VAT |
| `VATEX-EU-D` | `E` | Margin scheme — second-hand means of transport |
| `VATEX-EU-F` | `E` | Margin scheme — second-hand goods |
| `VATEX-EU-I` | `E` | Margin scheme — works of art |
| `VATEX-EU-J` | `E` | Margin scheme — collectors' items and antiques |
| `VATEX-EU-79-C` | `E` | Art. 79(c) — repayment of expenditure |
| `VATEX-EU-132`(`-1A`…) | `E` | Art. 132 — public-interest activities (postal, medical, education…) |
| `VATEX-EU-143`(`-…`) | `E` | Art. 143 — importation exemptions |
| `VATEX-EU-148`(`-…`) | `E` | Art. 148 — international transport, vessels, aircraft |
| `VATEX-EU-151`(`-…`) | `E` | Art. 151 — diplomatic bodies, international organisations, NATO |

National extensions exist under the same prefix convention: `VATEX-FR-CGI261-1`
(France), and notably **`VATEX-SA-*` in Saudi Arabia** — ZATCA adopted the EN
16931 pattern wholesale, so this layer is not EU-only.

### Mapping the engine's rules → EN 16931

| `ruleId` | Category | VATEX | Note |
|---|---|---|---|
| `P-B2B-EU-EU` | `K` | `VATEX-EU-IC` | intra-Community supply of goods |
| `P-B2B-EU-3` | `G` | `VATEX-EU-G` | export of goods |
| `S-B2B-EU-EU` | `AE` | `VATEX-EU-AE` | Art. 44 reverse charge |
| `S-B2B-EU-3` | `O` | `VATEX-EU-O` | place of supply outside the EU |
| `S-B2C-DIG-EU-3` | `O` | `VATEX-EU-O` | Art. 59 |
| `S-B2B-3-X` | — | — | non-EU seller: the seller's own national scheme governs |
| `P-B2C-EU-EU-OVER`, `S-B2C-DIG-EU-EU-OVER` | `S` | — | destination rate via OSS, not an exemption |
| `P-B2C-EU-EU-UNDER`, `S-B2C-DIG-EU-EU-UNDER` | `S` | — | seller's own rate |
| `P-B2C-EU-3` | `S` | — | origin rate; tax-free refund is a separate later step |
| `P-B2B-STAY`, `P-B2C-STAY`, `P-DOM-*`, `S-DOM-*`, `S-B2C-GEN-EU-*` | `S` | — | domestic rate |
| `P-B2B-3-EU`, `P-B2C-3-EU` | — | — | import: the buyer/declarant handles it, no seller invoice code |
| `S-ONSITE` (`onsiteLocation = customer`) | `O` **or** `S` | `VATEX-EU-O` | `O` on the seller's home invoice; `S` at the local rate once the seller is registered in the country of performance |

**This mapping is country-independent** — it holds for any EU seller, which is
what makes it worth putting in the record.

---

## Tier 2 — countries with their own mandatory national code list

Driven by real-time reporting or clearance mandates. Here the national code is
**required in addition to (or instead of) the EN 16931 code**.

| Country | System | Field | Code list |
|---|---|---|---|
| **HU** | NAV Online Számla 3.0 | `vatExemption/case`, `vatOutOfScope/case` | AAM, TAM, KBAET, KBAUK, EAM, NAM / ATK, EUFAD37, EUFADE, EUE, HO → `countries/HU/nav-codes.md` |
| **IT** | SdI / FatturaPA | `<Natura>` | N1, N2.1, N2.2, N3.1–N3.6, N4, N5, N6.1–N6.9, N7 — see below |
| **ES** | Veri\*factu + SII | `CalificacionOperacion` / `OperacionExenta` (mutually exclusive) | S1, S2, N1, N2 / E1–E6 (each naming a LIVA article) |
| **PT** | SAF-T (PT) | `TaxExemptionCode` + `TaxExemptionReason` | ~30 codes in `M01`–`M99`, each naming a CIVA/RITI article; code **and** text both mandatory |
| **PL** | KSeF, FA(3) from 2026-02-01 | `P_12` | `0 KR`, `0 WDT`, `0 EX`, `zw`, `np I`, `np II`, `oo` + the rate values |
| **GR** | myDATA (AADE) | `vatExemptionCategory` | numeric; grown across spec versions (23 → 31) |
| **RO** | e-Factura (CIUS-RO) | EN 16931 fields | tier 1 only — no separate national list |
| **FR** | Factur-X / PPF | BT-121 | `VATEX-FR-CGI*` national extensions |
| **RS** | SEF e-Fakture | tax category + *šifra osnova* | S, AE, O, OE, E, Z, R, SS, N + `PDV-RS-<article>-<para>-<point>` |
| **TR** | e-Fatura / e-Arşiv (UBL-TR) | `TaxExemptionReasonCode` | 3-digit codes keyed to KDV Kanunu articles: 301 goods export, 302 services export, 303 roaming, … 350 other |
| **EG** | ETA e-invoicing | `taxType` + `subType` | T1–T6 tax types; V001–V007 exemption reasons under T1 |
| **SA** | ZATCA Fatoora | `cbc:TaxExemptionReasonCode` | `VATEX-SA-*` (29 financial, 30 real estate, 32/33 export, EDU, HEA, OOS…) |
| **BR** | NF-e / NFS-e | `CST` per tax + `CSOSN` | ICMS CST 00/20/40/41/50/51/60/90 (+ origin digit), separate PIS/COFINS CST tables |
| **MX** | CFDI 4.0 | `ObjetoImp` + `TipoFactor` | 01–04; `Exento` vs `Tasa 0%` distinguished on the line's tax block |
| **MY** | MyInvois (LHDN) | `Tax Type` | 01–06 + `E` (exemption, with free-text reason) |
| **ID** | e-Faktur (DJP) | *kode transaksi* | 2-digit transaction-code prefix |
| **AE** | PINT AE (Peppol) | `cac:TaxCategory` + FTA treatment | EN 16931 categories + UAE VAT-treatment / free-zone fields |

### Italy — `Natura` codes

| Code | Meaning |
|---|---|
| `N1` | Escluse ex art. 15 (excluded — advanced expenses, default interest, returnable packaging) |
| `N2.1` | Non soggette — artt. 7 to 7-septies (place of supply outside Italy) |
| `N2.2` | Non soggette — other cases (e.g. regime forfettario) |
| `N3.1` | Non imponibili — exports |
| `N3.2` | Non imponibili — intra-Community supplies |
| `N3.3` | Non imponibili — supplies to San Marino |
| `N3.4` | Non imponibili — transactions treated as exports |
| `N3.5` | Non imponibili — under a declaration of intent (esportatore abituale) |
| `N3.6` | Non imponibili — other |
| `N4` | Esenti ex art. 10 (medical, financial, insurance, education) |
| `N5` | Regime del margine — VAT not shown on the invoice |
| `N6.1`–`N6.9` | Inversione contabile: scrap, gold, construction subcontracting, buildings, mobile phones, electronics, construction services, energy, other |
| `N7` | IVA assolta in altro Stato UE (OSS / distance selling) |

The aggregate `N2`, `N3`, `N6` codes have been rejected since 2021 — only the
granular sub-codes are accepted.

Note how `N2.1` ≈ HU `EUFAD37`/`HO`, `N3.2` ≈ HU `KBAET` ≈ ES `E5` ≈ PL `0 WDT`,
`N3.1` ≈ HU `EAM` ≈ ES `E2` ≈ PL `0 EX` ≈ TR `301`, `N4` ≈ HU `TAM` ≈ PL `zw`,
`N6.*` ≈ HU 142. § ≈ ES `S2` ≈ PL `oo` ≈ RS `AE`, `N7` ≈ the OSS case.

**The concepts line up across every tier-2 country; the codes never do.** That is
the whole design problem: one relation → one meaning → 12 different spellings.
Serbia is the cleanest of them (UNCL5305 categories plus a generated
`PDV-RS-<article>-<paragraph>-<point>` reason), Brazil the least comparable —
CST is per-tax and combines origin with treatment, and the 2027 CBS/IBS reform
will rewrite it anyway.

---

## Tier 3 — no code list at all (the majority)

**DE, AT, NL, BE, IE, DK, SE, FI, CZ, SK, SI, HR, BG, LT, LV, EE, LU, CY, MT**
and every non-EU country without a clearance mandate (GB, CH, NO, US, CA, AU,
NZ, JP…).

Here Art. 226(11) of the VAT Directive applies: the invoice must carry a
**textual reference** to the provision that makes the supply exempt or
reverse-charged — a national law citation, a Directive citation, or any
unambiguous wording. No machine-readable code is mandated. In practice:

- reverse charge → `"Reverse charge"` / `"Steuerschuldnerschaft des Leistungsempfängers"` / `"Autoliquidation"`
- intra-Community supply → `"Intra-Community supply — Art. 138 Directive 2006/112/EC"`
- export → `"Export — Art. 146 Directive 2006/112/EC"`

If such a seller issues a **structured** e-invoice (XRechnung, ZUGFeRD, Peppol
BIS, Factur-X), the tier-1 EN 16931 codes apply anyway. So tier 3 is really
"tier 1 plus free text", not "nothing".

---

## What none of these tiers can be derived from the relation

The same gap as in Hungary, in every country:

- **Small-business exemption.** HU `AAM` is not special — every EU state has one
  (DE `§19 UStG` Kleinunternehmer, FR *franchise en base*, IT *regime
  forfettario* → `N2.2`, ES *recargo*-adjacent regimes…), and since 2025 the
  **EU SME scheme** lets it apply cross-border with an `EX`-suffixed VAT number.
  This is a seller-status flag, not a property of the transaction, and it
  overrides the relation-derived result for the *whole invoice*.
- **Activity-based exemptions** (medical, education, financial, insurance,
  property letting) — HU `TAM`, IT `N4`, PT `M04`/`M05`, VATEX-EU-132. Depends
  on what is being sold, which the engine does not ask.
- **Out-of-scope items** (damages, penalties, public-authority acts, transfers
  of a going concern) — HU `ATK`, IT `N1`, ES `N1`.
- **Domestic reverse charge** (construction, scrap, electronics, energy) —
  HU Áfa tv. 142. §, IT `N6.*`, ES `S2`, PL `oo`. Depends on the product
  category and on both parties being domestic taxable persons.
- **Margin schemes** — VATEX-EU-D/F/I/J, IT `N5`, HU `marginSchemeIndicator`.

To cover any of these the wizard would need new inputs (a seller-status flag and
a supply-category question); the relation alone cannot produce them.

---

## Per-country coverage — implemented

This is no longer a document-only survey. 62 of the 68 countries carry a
`rate: 0` entry in `reducedCategories` (`countries/{CODE}/country.json`) whose
optional `type` array lists that country's 0% / exempt invoice codes.

```
countries/HU/country.json   reducedCategories[rate 0].type   ← the catalogue
countries/HU/engine.ts      ruleId → code map, customize()   ← the mapping
                                    ↓
results.json                record.invoiceCode
```

The split is deliberate. `type` says which codes **exist** in that country;
`engine.ts` says which one belongs to a given **relation**. Only some codes can
be mapped at all — small-business exemption (HU `AAM`, IT `N2.2`),
activity-based exemptions (HU `TAM`, IT `N4`), domestic reverse charge and
margin schemes depend on the seller's status or on what is being sold, which
the calculator never asks. They stay in the catalogue and are never attached to
a record.

The six countries without a `rate: 0` entry: HK, KW, QA (no consumption tax),
US (sales tax — exemption runs on the buyer's certificate), GE and ID (code
list not established).

**Current state:** 40 of 68 countries marked `verified: true`; 10379 zero-rate
records out of 14,424 carry a code. The EU-27 is complete for every
relation-derived rule (PT missing one case). The gap is concentrated in nine
non-EU sellers — AR, BR, CL, CO, GE, ID, MX, MY, NG — where the country has an
e-invoicing regime but the service-export code could not be confirmed from a
reliable source; those are `verified: false` with an empty mapping rather than
a guess. HK, KW and QA have no code because they have no consumption tax.

Three patterns are worth naming:

1. **The EU is converging, not diverging.** RO and HR built their mandates
   directly on EN 16931 rather than inventing a national list; FR extended
   VATEX instead of replacing it. ViDA pushes further in that direction.
2. **The EU model is being exported.** SA uses `VATEX-SA-*`; AE built PINT AE on
   Peppol BIS 3.0; NO, SG, AU, NZ and JP are all Peppol-aligned. The EN 16931
   category code is closer to a world standard than to a European one.
3. **Latin America and Asia are a separate lineage.** BR, MX, CL, CO, CN, VN,
   TW and KR grew clearance systems independently and encode tax status through
   transaction-type or rate-field values, not exemption reasons. That is exactly
   where the nine unmapped sellers sit — the concept does not translate cleanly.

Countries whose `code` values are national rather than the EN 16931 categories
(a closed official list in HU, IT, ES, PL, PT, RS, TR, EG, SA, BR, MX, MY; a
simple taxable/exempt flag in the rest): AR, BR, CL, CN, CO, EG, ES, HU, IN, IT, KR, MD, MX, MY, NG, PH, PL, PT, RS, SA, TH, TR, TW, UA, VN.

## Sources

- [Peppol BIS 3.0 — UNCL5305 code list](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL5305/) · [VATEX code list](https://docs.peppol.eu/poacc/billing/3.0/codelist/vatex/)
- [European Commission — Technical guidance for tax codes in EN 16931](https://ec.europa.eu/digital-building-blocks/sites/download/attachments/467108974/eInvoicing%20technical%20guidance%20document_v1.pdf)
- Italy: [Natura code guide](https://scontrinozero.it/guide/codici-natura-iva)
- Spain: [Veri*factu CalificacionOperacion / OperacionExenta](https://support.fiskaly.com/hc/es/articles/26705130096028)
- Portugal: [SAF-T tax exemption codes](https://docs.eezi.io/docs/code-lists-portugal-exempt-reason-codes)
- Poland: [KSeF FA(3) — P_12 values](https://www.fakturowo.pl/pomoc/stawki-vat-w-ksef)
- Greece: [myDATA REST API documentation (AADE)](https://www.aade.gr/sites/default/files/2023-02/myDATA%20API%20Documentation_v1.0.6_eng.pdf)
- Saudi Arabia: [ZATCA XML implementation standard](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf)
- Serbia: [SEF — određivanje poreske kategorije](https://www.paragraf.rs/baza-znanja/e-fakture/odredjivanje-poreske-kategorije-sifre-osnova-element-kreiranje-efakture-elektronske-fakture.html)
- Türkiye: [e-Fatura istisna kodları (TaxExemptionReasonCode)](https://nes.com.tr/e-fatura-istisna-kodlari/)
- Egypt: [ETA SDK — tax types](https://sdk.invoicing.eta.gov.eg/codes/tax-types/)
- Malaysia: [MyInvois SDK — tax types](https://sdk.myinvois.hasil.gov.my/codes/tax-types/)
- Brazil: [Tabela CST ICMS](https://www.contabeis.com.br/tributario/cst/)
- UAE: [PINT AE / Peppol mandate](https://www.avalara.com/blog/en/europe/2026/03/uae-e-invoicing-mandate-2026-readiness-asp-pint-ae.html)

> Decision support, not tax advice. Code selection is ultimately governed by the
> actual substance of the transaction.
