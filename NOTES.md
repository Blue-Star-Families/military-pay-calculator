# Maintainer Notes

Internal reference for updating and maintaining the Military Take-Home Pay Estimator. Not needed by end users.

## File structure

| File | Purpose |
| --- | --- |
| `index.html` | The entire app — UI, styling, and calculation logic in one file. |
| `bah-data.js` | 2026 BAH rate tables (338 housing areas). Loaded by `index.html` via `<script src>`. Must sit in the same folder. |
| `zip-data.js` | ZIP-to-housing-area map, packed. Also loaded via `<script src>` from the same folder. |
| `build-zip-data.js` | Regenerates `zip-data.js` from the DoD `sorted_zipmha` file. |
| `test.js` | Dependency-free calculation-engine test suite. |
| `test-dom.js` | Browser-DOM integration test suite. |
| `package.json` / `package-lock.json` | Reproducible Node.js test scripts and pinned development dependencies. |
| `.github/workflows/test.yml` | Runs both suites on pushes and pull requests. |

Check counts are deliberately not written here: each suite prints its own
`PASS n/n` line, and hardcoded counts in this file went stale several times
over. **After copying files in, confirm the count moved** — an unchanged count
after adding tests means the run tested old files.
| `README.md` | Public overview. |
| `LICENSE` | MIT. |
| `NOTES.md` | This file. |

Both `index.html` and `bah-data.js` must be deployed together or BAH auto-fill breaks. Degraded mode is handled explicitly: if `bah-data.js` is missing or blocked, the station dropdowns are disabled and relabeled "BAH data unavailable — enter BAH manually," and every other calculation still works from a manually entered BAH.

## Data sources (all 2026)

- **Basic pay** — DFAS / FY2026 NDAA (3.8% raise, effective 1 Jan 2026). Hardcoded in the `PAY` object in `index.html`.
- **BAS** — DFAS: $476.95 enlisted / $328.48 officer (`BAS_ENL` / `BAS_OFF`).
- **BAH** — DoD DTMO `BAH-ASCII-2026` files, parsed into `bah-data.js`.
- **Federal brackets & standard deduction** — IRS Rev. Proc. 2025-32 (`BRACKETS`, `STD_DED`).
- **FICA** — Social Security wage base $184,500 (`SS_WAGE_BASE`); Additional Medicare 0.9% over $200,000.
- **State income tax** — 2026 brackets & standard deductions in the `STATES` object. Originally compiled from the Tax Foundation; **all 20 jurisdictions that tax military pay were re-verified against their own revenue departments in October 2026**, and 9 were wrong (see "Final tally" below). Each verified entry carries its source in a comment. The other 31 (no tax, exempt, or conditional) were not individually re-verified. Active-duty treatment per MyAirForceBenefits "Which states tax my active-duty pay." Each state is one of: `none` (no income tax), `exemptDefault` (fully exempts active-duty pay — box pre-checked), `cond` (taxed if stationed in-state, exempt if stationed elsewhere — taxed by default, note prompts the user to check the exempt box), or plain taxed. Fully-exempt set: AZ, AR, IL, IN, IA, KY, MI, MN, MO, MT, NM, ND, OK. Conditional set: CA, CT, ID, ME, NY, OH, OR, PA, VT. States that only exempt combat/National Guard pay (e.g., AL, KS, LA, NE, NJ, WV, WI) are treated as taxed. State-specific mechanisms the engine models: `fedDeduct` (Alabama deducts federal income tax paid — `stateTaxAnnual` receives the member's annual federal tax), and `credit` / `creditPhase` (taxpayer credits subtracted after tax, e.g., Utah's phasing-out credit, Oregon's exemption credit, Delaware's $110 personal credit), `sdPhase` (a standard deduction that shrinks by a share of income above a threshold — Wisconsin; the intended mechanism for Alabama once its chart is known), and `persExempt` (per-person exemptions taken alongside the deduction — Wisconsin $700, Rhode Island $5,250). All four are opt-in per state; a state without the key is unaffected. Graduated brackets are used for CT, DC, KS, NE, NJ, WI (previously flat approximations).
- **Executive Schedule pay caps** — OPM Salary Table 2026-EX: Level II **$228,000/yr** (O-7–O-10), Level V **$184,900/yr** (O-6). `PAY_CAP` is *derived* as annual ÷ 12, so only the two annual figures (`ES_LEVEL_II`, `ES_LEVEL_V`) are ever edited.
  > ⚠️ An earlier version of this line read "Level II $18,808.20, Level V $15,258.30". Those were the **2025** monthly figures — the exact stale values that clipped correct 2026 pay and were reported by a reviewer in September 2026. Do not copy them back.

## Updating for a new year (e.g., 2027)

1. **BAH:** download `BAH-ASCII-2027.zip` from travel.dod.mil (Allowances → BAH → BAH Data Collection). Unzip. Regenerate `bah-data.js` from `bahw27.txt`, `bahwo27.txt`, `mhanames27.txt`. Column order is fixed: `E1..E9, W1..W5, O1E, O2E, O3E, O1..O10` (27 columns). The `BAH_COL` map in `index.html` encodes this.
   **Also regenerate the ZIP map from the same bundle** — it changes yearly too:
   ```
   node build-zip-data.js sorted_zipmha27.txt
   ```
   The script prints a round-trip check; `round-trip errors` and `phantom lookups` must both be 0 before committing.
2. **Basic pay:** replace the `PAY` object with the new year's monthly table.
3. **BAS:** update `BAS_ENL` / `BAS_OFF`.
4. **Federal:** update `BRACKETS`, `STD_DED`, and `SS_WAGE_BASE`.
5. **Pay caps:** update the two **annual** figures `ES_LEVEL_II` and `ES_LEVEL_V` from the new OPM Salary Table EX. `PAY_CAP` derives from them — do not edit it directly.
6. **State tax:** **not a spot-check.** Re-read every one of the 20 military-pay-taxing jurisdictions against its own revenue department (each entry's comment names the source used last time). In October 2026, 9 of 20 were wrong — five of them because a 2025 or 2026 bill changed the rate, which a spot-check would not catch. Watch for the date trap: states publish next year's estimated-tax forms in September, so a form dated in the current year may carry next year's figures.
7. Update the year labels in the header, badge, and disclaimer text.

## Calculation model (assumptions)

- Federal income tax is estimated as **annual liability ÷ 12** using the standard deduction — an estimate of paycheck impact, not exact W-4 withholding.
- Taxes are computed on the **service member's own pay only** (basic pay + taxable special pays, less Traditional TSP). Spouse/household income is deliberately not modeled — it would lower the member's own paycheck take-home, which is confusing for a paycheck tool.
- **Allowances (BAH, BAS) and FSA are non-taxable.** All other special pays are taxable.
- **Combat zone:** enlisted and warrant officers fully excluded from federal income tax; commissioned officers capped at max enlisted pay + IDP (`CZTE_CAP`). FICA still applies.
- **TSP:** Traditional reduces federal and state taxable income (not FICA); Roth does not reduce taxable income but is still deducted from take-home.
- **State standard deductions** are applied to military income alone (accurate for a single-income household). Head-of-household uses single-filer figures as an approximation.

## External validation (DoD/CRS benchmark)

Checked against independent published figures: CRS *Defense Primer: Regular
Military Compensation* (IF10532, Table 1), citing DOD **Selected Military
Compensation Tables, January 1, 2026**.

- **BAS matches exactly** — $5,723/yr enlisted, $3,942/yr officer.
- **Basic pay** — every DoD grade average falls inside our table's range.
  This benchmark is what surfaced the missing **E-1 under-4-months rate**
  ($2,226 vs $2,407); it is now a separate selectable grade.
- **BAH** — our unweighted mean across 338 areas differs from DoD's averages by
  −1.6% (E-5) to −11.5% (O-6). Expected: DoD weights by troop population, which
  concentrates in high-cost areas. Per-area values are verified exact against DTMO.
- **Federal tax advantage** — ours runs ~12–16% below the DoD figure for most
  grades. Expected and not a defect: the DoD number includes the **Earned Income
  Tax Credit** and an averaged household composition, while this tool models the
  individual's own filing status with no credits. (DoD's own figures are
  non-monotonic — E-8 advantage sits below E-5 — which only makes sense with
  varying dependent/credit assumptions.)

## BAH lookup: duty station or ZIP

Each scenario offers a **Duty station / ZIP code** toggle. Both fill the same
BAH field; the member picks whichever they know.

ZIP exists because members frequently live away from their duty station — Guard
and Reserve on Title 10 or ADOS orders that can run two years, Navy families who
geo-bach through a homeport shift. Previously the page sent those people to the
external DoD BAH lookup, which loses them.

- `zip-data.js` packs the official DTMO mapping: 40,959 ZIPs collapsed into
  23,844 ranges over 339 areas, base-36 encoded, ~135 KB instead of 533 KB.
  `zipToMha()` binary-searches the ranges.
- **Ranges never span a gap in ZIP numbering.** An unassigned ZIP returns null
  and the UI says so, rather than inheriting a neighbour's rate.
- A failed lookup (unknown ZIP, or an overseas ZIP that uses OHA) **zeroes the
  BAH field**. Leaving the previous location's rate there looks plausible and
  would silently price the wrong place.
- The chosen mode round-trips in shared links via the hidden `modeA`/`modeB`
  fields, and `__restoreLookupModes()` runs *after* `applyState()`. Without that,
  a ZIP link reopened on the station tab; for a cost-group area — which has no
  dropdown entry — the station came back blank and a later grade change left the
  old rate in place.

**County cost groups are deliberately absent from the dropdown.** The 39
`COUNTY COST GROUP nnn` areas are DFAS bookkeeping for rural counties outside any
named metro area; no member knows their cost group. They remain reachable by ZIP,
and a test asserts all 39 still resolve. Real county *names* (Honolulu County,
Maui County) are kept — those are places people recognise.

## Scope decision: special pays are "what I'm getting now"

Settled with the reviewer, Sep 2026. There are 60+ special and incentive pay
categories across the services, and two ways to present them:

1. **What am I getting now** — the member ticks what applies and types the
   amount. This is what is built.
2. **What could I earn** — every category from FMR Volume 7A, amounts derived
   from grade and branch.

Option 1, deliberately. The tool answers "how far does my pay go in a different
place," and the member has the real figures on their LES. Option 2 is a
recruiting and career-planning tool — a reasonable thing to build one day, but a
different product, and the reviewer's view was that it is "farther down the line
and a much bigger build."

The **Other special pay** row is what makes this work: anything not listed gets
entered there, so no one is blocked by a missing category. Do not replace that
with a long taxonomy without revisiting the decision above.

The listed defaults are common 2026 maximums, which is a nudge toward option 2.
They are only applied when a row is ticked, and the section says the surest
figures are the ones on the LES — keep that wording if the defaults stay.

## Constants the tests cannot actually vouch for

A reviewer with a real LES found that `PAY_CAP` held 2025 Executive Schedule
figures while the pay table already held 2026 rates, so the stale ceiling was
clipping correct pay — about $150/month for a senior O-6, $191 for an O-9.

**Every automated check passed the whole time.** The test asserted the same
literal the app used, so it only proved the constant had not been edited by
accident. Self-consistent, and wrong. Worth being precise about which constants
are genuinely anchored and which are not:

| Constant | How it is checked | Goes stale silently? |
| --- | --- | --- |
| BAS | vs DoD annual figures via CRS IF10532 | No — external anchor |
| BAH | 18,252 cells vs DTMO source files | No — external anchor |
| Basic pay | DoD grade averages must fall in range | Partly — a whole-table shift could pass |
| SGLI | recomputed from rate x cover + TSGLI | No — formula, not literals |
| `PAY_CAP` | derived from the OPM annual rate / 12 | Only if the OPM annual figure is stale |
| `CZTE_CAP` | derived from the pay table + IDP | No — tracks the table |
| `SS_WAGE_BASE` | literal, **cited + hand-verified vs SSA** | Yes — recheck each January |
| `STD_DED` | literal, **cited + hand-verified vs Rev. Proc. 2025-32** | Yes — recheck each January |
| `BRACKETS` | all 21 floors + rates asserted vs Rev. Proc. 2025-32 | Yes — recheck each January |
| `ADDL_MEDI_THRESHOLD` | one table, statutory (IRC 3101(b)(2)) | No — not inflation-indexed |
| `MEDI_RATE` / `SS_RATE` | asserted against own literal | Yes, but statutory and rarely change |

These change every January and nothing in the suite can tell you the year
turned. **At the yearly update, re-read the IRS Revenue Procedure and the SSA
fact sheet and retype these by hand** — passing tests are not evidence they are
current, only that nobody fat-fingered them since.

### Audit of 2026-09, after the `PAY_CAP` miss

All four flagged constants were re-read against primary sources:

- `SS_WAGE_BASE` $184,500 — correct (SSA).
- `STD_DED` 16,100 / 32,200 / 24,150 — correct (Rev. Proc. 2025-32 §3.19).
- `BRACKETS` — **one error found.** The head-of-household 32% floor was 201,775,
  copied from the single column; the published HoH figure is **201,750**. Fixed.
  Single/MFJ were correct. A HoH filer above ~$201,775 taxable was undertaxed by
  $2/year — trivially small, and exactly the kind of thing that never surfaces
  from a reconciliation complaint, only from reading the source.
- The Additional Medicare threshold was a bare literal duplicated at the call
  site; it is now one table referenced from both places.

The HoH row is a trap for anyone tidying this file: its 32% and 35% floors sit
$25 below single's, which reads like a typo and is not. Two tests assert the
gaps deliberately so a future "cleanup" fails loudly.

### First reconciliation against a real LES (O-3, 15 yrs, Navy, TN, Jun 2026)

A reviewer reported federal and Medicare "way off" plus $77 unexplained. The
statement settled all of it, and most of the news was good:

| Line | LES | Engine | |
| --- | --- | --- | --- |
| BAS (officer) | 328.48 | 328.48 | exact |
| FICA Social Security | 558.26 | base x 6.2% = 558.26 | exact |
| FICA Medicare | 130.56 | base x 1.45% = 130.56 | exact |
| Federal withheld | 1,218.51 | ~1,245 | ~27 high, expected |

"Medicare way off" was a year-to-date figure (308.99) compared against a monthly
one. Nothing was wrong.

The $77 was a **DEBT line of 120.53**, which the app had no field for, partly
offset by 26.00 of assumed SGLI the member was not charged and the ~27 federal
difference. Net 67.95. Users can already enter it under "Other monthly
deductions"; the hint there now says so explicitly, because nobody reads a debt
repayment as an "allotment".

Federal will not reconcile exactly and should not be expected to: the app models
annual liability / 12, DFAS withholds per IRS Pub 15-T tables.

Two smaller things this surfaced, both deliberately left alone:

- **The basic pay table stores whole dollars.** DFAS publishes cents — this
  member's O-3 rate is 9,004.20, the table holds 9,004. That is why Social
  Security came out at 558.25 against a real 558.26. Every result is up to
  ~50 cents light. Immaterial for an estimator, and re-keying 500+ cells to
  chase it would create far more risk than it removes, but it is the reason a
  penny-exact match is not achievable and should not be promised.
- **"Other monthly deductions" is treated as post-tax.** This member's debt was
  pre-tax (LES federal wage = basic pay minus the debt, exactly). Entering it in
  that field reduces take-home but not taxable income, which leaves ~27/month
  on a 120.53 debt at the 22% bracket. Adding a pre-tax/post-tax toggle is the
  obvious fix and also one more decision to put in front of a user who is
  already guessing. Revisit only if a second LES shows the same pattern.

Three behaviours this externally confirmed, which no internal test could:
FICA is computed on basic pay; Roth TSP does **not** reduce the FICA wage; and
Roth TSP does **not** reduce federal taxable wages (LES federal wage 8,883.67 =
basic pay 9,004.20 minus the pre-tax debt, with the 1,350.63 Roth not deducted).

### Special-pay defaults audit (2026-09)

The `SPECIALS` defaults were the last cluster of numbers with no external
anchor, and the field label promises "common 2026 maximums". Two were wrong:

| Row | Was | Now | Source |
| --- | --- | --- | --- |
| Career sea pay | 805 | **750** | FMR 7A Ch 18 para 4.1 — $750 is the statutory ceiling; 805 exceeded it outright |
| Submarine duty pay | 175 | **950** | FMR 7A Ch 23 Table 23-1, O-5/O-6 over 18; 175 was a near-bottom enlisted cell |

Both wrong values appear in the *other* pay's published table, so this looks
like cross-contamination between two DFAS pages rather than two separate slips.

**Second pass (October 2026) closed out the remaining six.** One more was wrong:

| Row | Was | Now | Source |
| --- | --- | --- | --- |
| SDAP | 450 | **750** | FMR 7A Ch 8 para 2.4.2. 450 was the pre-2017 ceiling — $300 stale. |

Confirmed correct: ACIP 1000 (Ch 22 Tables 22-6/22-8/22-9), diving 340, hardship
150 (Ch 17), FSA 250 (Ch 27), HFP/IDP 225 (Ch 10), HDIP 150, jump 150, HALO 225.

Two traps for a future editor, both now spelled out in the code:

- **Diving 340 is the Master Diver rate.** Plain diving HDIP is capped at $240
  (Ch 11 para 2.5.1); 340 comes from Tables 11-2/11-4. Someone reading only the
  cap paragraph will "fix" it to 240 and be wrong.
- **Hardship 150 is HDP-L/HDP-M.** HDP-Tempo goes to $500 and HDP-ROM to
  $1,500/month, so 150 is not the arithmetic maximum, it is the common case.

**Final tally: three of eleven defaults were wrong** — 27%. The test now fails
if any special pay carries a non-zero default without a citation, which is the
condition that let all three in.

Note CSP-Premium ($200-350, FMR 7A Ch 18 para 4.2) is a separate entitlement and
is **not** folded into the sea pay default. A member drawing it should add it
under "Other special pay".

The general rule this earned: a constant that can be derived should be derived,
and a constant that cannot should be checked against something outside this
repository. Asserting a literal against itself buys nothing.

## Tester feedback triage (October 7, 2026)

Six real responses on the form. What each one turned out to be:

| Reporter | Report | Verdict |
| --- | --- | --- |
| O-3, Knoxville | federal/Medicare "way off", $77 unexplained | **Not a bug.** YTD compared against monthly; the $77 was a pre-tax debt line. Fixed the hint. |
| O-5, Camp Lejeune | "BAH is incorrect, current BAH 2355" | **Table is almost certainly right.** 2355 is *exactly* our Camp Lejeune **O-4 with-dependants** rate (O-5 is 2553, O-5 without dependants 2016). The number did not come from nowhere — it is a real cell in our own table, one grade down. Needs a question back to her, not a data change. |
| O-4, Berkeley | scenario B kept her current CONUS COLA; wants per-station special pays | **Real bug, fixed.** COLA now has a per-scenario amount. Every other special pay still follows the member, which is correct — only COLA is paid *for where you are*. |
| O-5, NSA Mid-South | BAH ~$20 low; $300/mo extra withholding had no field; total off ~$100 | Extra withholding **fixed** (W-4 4c field added). The $20 BAH gap is unexplained — BAH rate protection on a falling rate is the obvious candidate and worth asking about. |
| O-4, Memphis | accurate | — |
| E-4, Norfolk/Portsmouth | gross monthly wrong by $39 | **Unresolved.** Gross is basic + BAH + BAS, and $39 matches no obvious boundary: the Norfolk E-4 with/without-dependants gap is $522, and the E-4 4-to-6-year step is $156. Needs his three figures. |

Two patterns worth carrying forward. First, **every "your data is wrong" report
so far has turned out to be a question about which row applies, not a wrong
row** — so check whether the reported figure appears somewhere in our own table
before touching data. Second, small unexplained deltas have twice been something
real but invisible on the LES (a debt line, extra withholding), so chase them
rather than writing them off as estimator noise.

### Deploying: verify the push, do not silence it

A push to `bsf` failed silently because the command piped its output to `$null`,
and two commits later the live site was still missing a change that `git log`
said had shipped. **Always check `git rev-parse` against both remotes after
pushing**, or read the push output. GitHub Pages also reports the commit it
built — `gh api repos/<owner>/<repo>/pages/builds/latest --jq .commit` — which
is the fastest way to tell "not deployed yet" from "never pushed".

## The state tax table is the largest unverified surface (October 2026)

51 jurisdictions, and until now **not one had been checked against a state
revenue department.** The "hand-computed golden values" in the suite recompute
from the app's own constants, so they prove arithmetic and nothing about whether
the rate is this year's. Identical trap to `PAY_CAP`.

Six states checked so far. **Four were wrong:**

| State | Was | Now | Source |
| --- | --- | --- | --- |
| GA | 5.19%, SD 12,000 / 24,000 | **4.99%, SD 15,000 / 30,000** | GA DOR "Important Tax Updates"; HB 463, signed May 2026 |
| SC | 0 / 3% / 6%, SD 8,350 / 16,700 | **1.99% / 5.21% over 30,000, deduction 15,000 / 30,000** | SCDOR; Act 110, signed 30 Mar 2026 |
| WV | 2.22 / 2.96 / 3.33 / 4.44 / 4.82 | **2.11 / 2.81 / 3.16 / 4.22 / 4.58** | WV Tax Division; SB 392, Code 11-21-4j, retroactive to 1 Jan 2026 |
| HI | SD 4,400 / 8,800 | **8,000 / 16,000** | HI DOTAX FAQ (updated 27 Aug 2026); Act 46, SLH 2024 |
| VA | SD 8,750 / 17,500 | unchanged — correct | Virginia Tax, TY2026 |
| MD | brackets + SD 3,350 / 6,700 | unchanged — correct | MD fiscal note HB 1238; BRFA 2025 top rates already present |

Hawaii is the clearest example of the failure mode: DOTAX lists 4,400 / 8,800
**verbatim as the 2025 amounts** on the same page that gives 2026 as
8,000 / 16,000. Act 46 steps the deduction every two years, so a year-stale copy
is not off by an inflation nudge — it is off by nearly half. Roughly $23/month
for a Hawaii E-5, against Pearl Harbor-Hickam, Schofield, Kaneohe Bay, Wheeler.

Hawaii's **brackets** are still unverified: Act 46 widens those on a staggered
schedule too, and DOTAX does not publish the table in prose.

Maryland was checked and is correct — but its local add-on was mislabelled. We
apply 3.20%, which is the *highest* county rate (2026 rates run 2.25%–3.20%),
while the note called it an average. The note now says "highest rate", so the
estimate is understood as conservative rather than typical.

South Carolina was not a rate tweak but a restructure: three brackets became
two, and the federal-linked standard deduction became the SC Income Adjusted
Deduction. We were running the entire 2025 structure.

West Virginia publishes only three of its five rates in prose. The other two
were derived and then **checked against the Tax Division's own anchor** — tax at
$60,000 is $1,950.50, and the five brackets sum to exactly that. The test
asserts the anchor rather than the rates, so any single wrong rate breaks it.

Georgia over-taxed every Georgia resident by roughly **$19/month**, and Georgia
carries a large military population. The GA golden test had been written as
`(60000-12000)*0.0519` — the same stale numbers the app held — so it passed
throughout. It is now written with literals from the DOR page, plus two explicit
"not still on the 2025 figure" assertions.

**Only 20 of the 51 jurisdictions actually tax military pay**, so that is the
set worth the effort:

> AL CO DE DC GA HI KS LA MD MA MS NE NJ NC RI SC UT VA WV WI

Nine have no income tax (AK FL NV NH SD TN TX WA WY), 13 exempt military pay by
default (AZ AR IL IN IA KY MI MN MO MT NM ND OK), and 9 are conditional
(CA CT ID ME NY OH OR PA VT) — errors there are mostly invisible.

### Round two: CO, LA, AL (October 2026)

| State | Verdict |
| --- | --- |
| CO | **Correct.** Flat 4.40% confirmed; the 2024 bill to cut it to 4.0% was postponed indefinitely and never took effect. Colorado starts from *federal* taxable income, so its deduction is correct by construction — a test now asserts it tracks `STD_DED` rather than drifting. |
| LA | **Rate correct**, flat 3% (graduated brackets repealed from 1 Jan 2025). **Deduction knowingly imperfect**: 12,500 / 25,000 is the statutory base, and from 2026 Louisiana indexes it to CPI-U. The indexed figure is not published anywhere reachable, so we hold the base. Under-deducts slightly; over-states tax by a few dollars a month. Bounded and documented, not guessed. |
| AL | **Brackets correct** (2 / 4 / 5% at 500 and 3,000 single; 1,000 and 6,000 joint) — now asserted. **Deduction deliberately left alone.** |

**Why Alabama was not changed.** Alabama has no single standard deduction; it
has an AGI-based Standard Deduction Chart that phases down. Published maximums
are 4,500 / 11,500, with a lower floor. Our 3,000 / 8,500 sits between the two,
so it is either a considered mid-chart value or stale — and the chart itself is
not on any ALDOR page I could reach. At military income levels the chart is
probably at or near its floor, which would mean our figure is too *high*, not
too low. Changing it on a guess would be worse than leaving it. **Needs the
chart from the Form 40 booklet.** This is the one entry where the right move was
to stop.

### Round three: KS, MS (October 2026)

Both **correct** — but each had a trap that would have produced a wrong "fix":

- **KS.** KDOR states the joint upper band as "5.58% **minus $175**". That $175
  is a continuity constant, not a deduction: .0558 × 46,000 − 175 = 2,391.80,
  and .052 × 46,000 = 2,392. Our marginal brackets already reproduce it. Adding
  a $175 subtraction would double-count. Two tests now assert the figure from
  both directions so the trap is visible.
  HB 2629 would raise the deduction to 3,805 / 8,640 for 2026, but there is no
  evidence it was enacted and the 2026 estimated-tax form still prints the 2025
  amounts. Left alone; recheck in January.
- **MS.** Rate confirmed 0% on the first 10,000 then 4% for 2026, dropping to
  **3.75% in 2027** — diary that. The `sd` of 8,300 / 16,600 looks wrong at a
  glance but is right: it combines MSDOR's exemption (6,000 / 12,000) with the
  standard deduction (2,300 / 4,600). A test now pins the combination so nobody
  "corrects" 8,300 down to 2,300.

**MSDOR contradicts itself**: its Individual Income Tax FAQ page still prints
the 2025 rate of 4.4% while its General Information page gives 2026 as 4%. When
two pages of the same revenue department disagree, prefer the one that is
explicitly year-labelled, and record which you used.

### Round four: NC, NE, WI (October 2026)

| State | Verdict |
| --- | --- |
| NC | **Correct.** 3.99% (S.L. 2023-134), deduction 12,750 / 25,500 (G.S. 105-153.5). 2027 projected 3.49%. |
| NE | **Correct**, verified against NDOR's own 2026 Tax Table at four points, all to the dollar (see below). |
| WI | **Brackets correct to the cent; deduction wrong.** Fixed — engine change, see below. |

**Nebraska — the date trap.** NDOR's Form 1040N-ES dated September 2026 shows a
9,100 / 18,200 deduction and a 3.99% top rate. That form is for tax year
**2027**. A search summary presented those as 2026 figures. Applying them would
have put next year's law into this year's tool — a "fix" that made it wrong.
The 2026 Tax Table settled it instead:

| Point | NDOR | Engine |
| --- | --- | --- |
| Single worksheet at 79,860 | 3,333 | 3,332.76 |
| Joint worksheet at 79,860 | 3,032 | 3,031.89 |
| Single row 4,260–4,360 | 108 | 107.92 |
| Joint row 8,260–8,360 | 205 | 205.06 |

Nebraska has four statutory brackets, but in 2026 the third and fourth share
4.55%, so our three-bracket form is equivalent — the joint anchor lands on 3,032
only if that is true. Tests assert NDOR's printed figures and guard against the
2027 values. **For January 2027:** top rate 3.99%, single thresholds
4,270 / 25,570 / 41,200, deduction 9,100 / 18,200 — all from that same form.

**Wisconsin — a modelling error, not a stale number.** Brackets match DOR's
printed cumulative tax exactly (2,149.81 at 51,950; 17,030.62 at 332,720;
2,866.09 joint at 69,260). But Wisconsin's standard deduction is a **sliding
scale**:

- single: 13,960 less 12% of WI income over 20,120, zero at 136,453
- joint: 25,840 less 19.778% over 29,040, zero at 159,690

We gave everyone the maximum, which **under**-taxed Wisconsin residents — about
$10/month for an E-5, about $39/month for an O-4. Most other state errors
over-taxed; this one went the other way, and grew with rank. We also omitted the
$700 personal exemption DOR takes on the same line.

Fixed by adding two generic, opt-in keys to the state engine rather than a
Wisconsin special case: `sdPhase` (threshold + rate per filing status) and
`persExempt`. Any future sliding-scale state can use them. Dependant exemptions
($700 each) are still not counted, because the app does not ask for a count.

**One more to know about Alabama:** it also uses a sliding-scale deduction.
`sdPhase` is now the mechanism to model it, once someone has Alabama's actual
chart.

### Round five: UT (October 2026)

**Wrong, and it had no test at all.** SB 60 (2026 General Session, Chapter 250)
cut Utah's rate from 4.5% to **4.45%**, retrospective to 1 January 2026. Two
primary sources agree: Utah Code 59-10-104 as amended, and the Tax Commission's
Publication 14 (Rev. 4/26), whose withholding schedules multiply by .0445.

The taxpayer credit checks out by construction: it is 6% of the federal
standard deduction for a filer without dependants, so .06 × 16,100 = 966 and
.06 × 32,200 = 1,932. A test now asserts it tracks `STD_DED`. The 1.3% phase-out
rate matches Pub 14; the phase-out **thresholds** (16,000 / 32,000) are indexed
and unconfirmed for 2026 — a few dollars a year at most.

### Round six: NJ, RI, DE, MA, DC — audit complete (October 2026)

| State | Verdict |
| --- | --- |
| NJ | **Wrong constant, fixed.** Fifth band is 5.525%; we held 5.53%. Proof: NJ prints the band as "×.05525 minus $1,492.50", our lower brackets total 717.50 at $40,000, and .05525 × 40,000 − 1,492.50 = 717.50 exactly. With .0553 the constant would have to be 1,494.50, which NJ does not print. Trivial money (≤ $3.50/yr), wrong number. |
| RI | **Missing exemption, fixed.** Brackets and deduction were right (base taxes 3,076.88 and 8,035.88 reproduce exactly), but RI also allows **$5,250 per person** for 2026 (ADV 2025-22) and we carried none. Over-taxed ~$16/month single, ~$33 joint. Uses `persExempt`. |
| DE | **Missing credit, fixed.** Brackets and deduction right; the **$110-per-person** personal credit was absent (PIT-RES: "MFJ … no dependents, enter $220"). A 2017 bill text showing $85 never became law. Uses the existing `credit` key — no engine change. |
| MA | **Correct.** 5.00% flat; $4,400 / $8,800 exemption. |
| DC | **Brackets correct** (OTR base taxes 400 / 2,200 / 3,500 / 19,650 all exact). **Deduction unverified** — assumes federal conformity, and a June 2026 CFO presentation mentions pending decoupling legislation. Left alone deliberately. |

## Final tally — all 20 military-pay-taxing jurisdictions

| Outcome | Count | States |
| --- | --- | --- |
| **Wrong, now fixed** | **9** | DE, GA, HI, NJ, RI, SC, UT, WV, WI |
| Correct as shipped | 7 | CO, KS, MA, MS, NC, NE, VA |
| Correct but mislabelled, fixed | 1 | MD (local rate called "avg.", is the maximum) |
| Partially verified / known limit | 3 | AL (deduction chart unknown), DC (deduction assumes conformity), LA (deduction CPI-indexed, unpublished) |

**Nine of twenty had a real error — 45%.** Every one passed the existing suite,
because the "golden values" recomputed from the same constants the app held.

What the nine had in common, which is the useful part:

- **Year-stale after a legislated change** — GA, SC, WV, HI, UT. All five
  changed for tax year 2026 by a 2025 or 2026 bill. A yearly check against each
  revenue department would have caught all of them.
- **A mechanism the engine did not have** — WI (sliding-scale deduction), RI
  (per-person exemption), DE (per-person credit). These were not stale; they
  were never modelled. Two new generic keys, `sdPhase` and `persExempt`, now
  cover them, and Alabama can use `sdPhase` once its chart is known.
- **A transcription slip** — NJ, 5.53% for 5.525%.

Two process failures of my own, recorded so they are not repeated:

- New Jersey **fell off the running "remaining" list** for two rounds and would
  never have been checked. Derive the remaining set from the master list.
- Utah was briefly **misfiled as exempt-by-default** in these notes. It is not.

**Still knowingly imperfect:** AL's deduction, DC's deduction, LA's indexed
deduction, HI's brackets, UT's credit phase-out thresholds, and head-of-household
collapsing to single in every state. Dependant exemptions are not counted in
WI, RI or DE because the app does not ask for a count. Each is documented in its
`STATES` entry.

**For the January 2027 update:** NE (3.99%, deduction 9,100 / 18,200), MS (3.75%),
NC (projected 3.49%), RI (high-income surtax begins), and re-read every one of
the 20 against its revenue department — not against this file.

> **New Jersey fell off this list** two rounds ago: the "remaining" lists in
> Rounds two and three omitted it, so it would never have been audited. Found
> by recounting the 20 against the 15 examined rather than trusting the running
> list. **Derive the remaining set from the master list each round; do not
> carry it forward by hand.**

Running tally across the 15 examined: **six wrong** (GA, SC, WV, HI, WI, UT),
one mislabelled (MD), one unresolved (AL's deduction), seven correct. Four of the nine examined so far were wrong outright, one more was
mislabelled, and one is unresolved. That is not a sample that licenses assuming
the rest are fine.

Partially corroborated, but only against the Tax Foundation's 2026 change list
rather than a revenue department — so treat as *likely* right, not verified:
NC 3.99%, MS 4% over 10,000, NE top 4.55%. CO and LA did not appear on any 2026
change list, which suggests their rates are unchanged, but the *values* in our
table have still never been read off a state source.

One known-stale entry left alone because it is low impact — Montana exempts
military pay by default:

- **MT** holds 5.9%; the 2026 top rate is 5.65%.

> **Correction (Oct 2026):** an earlier version of this note also filed **Utah**
> here as exempt-by-default and low impact. That was wrong — Utah *taxes*
> military pay and was in the list of 20 all along. It has since been verified
> and fixed (4.5% → 4.45%); see Round five. Recorded rather than silently
> edited, because a note that confidently misclassifies a state is exactly how
> a real error gets waved through.

**Head of household is collapsed into single in every state.** `stateTaxAnnual`
does `filing==="mfj" ? 1 : 0`. Mostly harmless, since many states have no
separate HoH schedule — but South Carolina's new deduction is $22,500 for HoH
against $15,000 for single, so an SC head of household is now over-taxed. Fixing
it means a third slot in every `sd` and `b` entry, which is a real change to 51
records; worth doing, but not worth doing carelessly.

## Open items at handover (September 21, 2026)

Written before a period of leave, so whoever picks this up is not starting from
an empty room. Nothing here is broken; these are decisions and unfinished
verification, ordered by what bites first.

*Updated October 7, 2026. Items 1 and 5 are now done; item 2 changed shape.*

**Needs a person, not a code change**

1. ~~Default branch wrong on both repos.~~ **Done** — both now point at `main`.
2. **Embed in the content hub — DECIDED 8 Oct 2026** (Brittany: "probably #2").
   Sarah Schafer (Website Manager) is building the hub side; Josh Petit owns SEO.
   Waiting only on the **final hub URL**. What has to happen, in order:
     - **The github.io page must stay public.** The iframe loads from it on every
       visit. Brittany initially asked for it to be "inaccessible to the public"
       so the hub ranks — that would break the embed (and GitHub Pages cannot be
       private on a free org plan anyway). The real goal is met by `noindex`.
     - **At hub launch, change two lines in `index.html`:** line ~8
       `<link rel="canonical">` → the hub URL; line ~10 `robots` → `noindex,follow`.
       Do these together and *at* launch — not before, or there is a window
       where nothing ranks.
     - **Share links** build from `location.origin + location.pathname`
       (`collectState` area, ~line 1448). Inside an iframe that is the github.io
       URL, so shared links would bypass the hub. Needs a configurable base URL.
     - **Height.** The page is ~6,000px tall on a phone and grows in compare
       mode. A fixed-height iframe will clip or gap. Needs a small `postMessage`
       height broadcast here plus a few lines on the hub page.
     - **Design and copy changes happen in this repo**, not the CMS: the hub's
       CSS cannot reach into a cross-origin iframe. Brand styles and copy edits
       come to us and go through the tests like any other change.
     - **SEO reality:** Google mostly does not credit iframe content to the host
       page. The hub post needs its own written content to rank.
   `DNS-REQUEST.md` is now obsolete — the subdomain route was not chosen.
   Latent nit found while checking this: the feedback button's no-`replaceWith`
   fallback calls `window.open(...,"noopener")`, which returns null by spec, so
   it also navigates the current page. Only reachable on pre-2017 browsers;
   modern ones take the anchor path. Not worth a change on its own.

   *(Superseded text follows.)* Marketing originally intended the tool to
   live either on a simple domain of its own *or* as a post in the finance and
   benefits content hub (URL still under construction, Josh Peitt owns it).
   Those are different builds, so `DNS-REQUEST.md` is **on hold**, not ready to
   send: it assumes a CNAME to GitHub Pages, which only fits the first option.
     - *Subdomain:* one CNAME, nothing else changes.
     - *Embed in the hub:* the hub page ranks, this page runs underneath. When
       this is chosen, **the github.io page must stop competing with the hub
       URL** — set `rel=canonical` to the hub URL, or `noindex`. One line, and
       much cheaper than untangling two pages ranking for the same query later.
     - *Rebuild in the CMS:* gives up the test suite and the deploy path. Avoid.
3. **Annual update ownership.** The January refresh is documented but unassigned.

**Unfinished verification**

4. ~~Special-pay defaults not yet checked.~~ **Done** (October 2026) — all
   eleven verified against DoD FMR Volume 7A; SDAP was wrong (450 → 750) and is
   fixed. See "Special-pay defaults audit" above.
5. ~~Live special-pay defaults unconfirmed.~~ **Done** — fetched from the live
   page October 7: sea pay 750, submarine 950, both serving correctly.
6. **One LES, not many.** Every reconciliation claim in this file rests on a
   single O-3 Navy statement. A second and third, ideally enlisted and with a
   Traditional TSP election, would test paths that one statement never touched.
7. **No overseas LES has ever been tested.** The OHA mode is argued from the
   DoD rules, not checked against a real overseas pay statement. It is the
   newest code in the app and the least evidenced. Get one.

**Open design questions** (see the LES reconciliation section above for detail)

8. Pre-tax vs post-tax "Other monthly deductions".
9. The basic pay table stores whole dollars where DFAS pays cents.
10. Head of household collapses to single in every state (see the state audit).

**The habit worth keeping.** Every substantive bug fixed in September and
October 2026 — the pay cap, three special-pay defaults, nine state tax entries —
was found by a reviewer with a real pay statement or by reading a primary
source. **None was found by the automated suite, which passed throughout.** The
suite protects against regressions. It cannot tell you a number was wrong the
day it was typed in. The suite protects against
regressions. It cannot tell you a number was wrong the day it was typed in.

## Known limitations (intentional)

- BAH covers CONUS, Alaska, and Hawaii only. Overseas is OHA, which now has its
  own mode on the lookup switch. **OHA is not auto-filled and should not be.**
  It reimburses the member's actual rent up to a per-location, per-grade ceiling
  (travel.dod.mil, Overseas Housing Allowance), so two members in the same
  building can draw different amounts and no table can produce the right figure
  from grade and location. The mode changes labels and guidance only; the
  arithmetic is identical, because OHA and BAH are both non-taxable housing
  allowances. MIHA is deliberately excluded — it is a one-time move-in payment,
  not monthly, and folding it in would overstate every month of the year.
- State tax credits (CTC, EITC), itemized deductions, and local income taxes outside Maryland are not modeled.
- The `XX499 = "UNKNOWN, NA"` placeholder area in the DTMO data is filtered out of the station dropdown.

## Robustness & security (production hardening)

- **Input clamping** — `num(id,min,max)` coerces every numeric field; non-numeric/empty → 0, negatives clamp to 0, TSP capped at 100%. Prevents negative "other deductions" from inflating take-home.
- **Tamper guards** — unknown `filing` falls back to `single`; `yos` is clamped to the valid index range; unknown grade yields 0 base pay instead of throwing. A malformed or hostile share link cannot crash the page.
- **XSS** — user-supplied station labels are shareable via URL and rendered through `innerHTML`, so all label and state text passes through `esc()` (escapes `& < > " '`). Never render user input without `esc()`.
- **Negative BAH / NaN** clamps to 0.
- **`esc()` is defined at the top of the script** because it is called during initial render of the special-pay rows. Do not move it below its first use.

## Feedback form

**Currently live: the Google Form path.** The button under the results is a link
to the form; the in-page fields described below are hidden because they have no
endpoint to submit to.

The Google Form asks, in this order: Rank · Years of service · Duty station ·
State (all optional) · *Was this accurate or inaccurate…* · *How can we improve
it…* · Name · Email (those four required).

**The first four arrive pre-filled.** `feedbackUrl()` appends them as prefill
parameters using the ids in `FEEDBACK_PREFILL`, so the reporter only answers the
two questions that need a human.

> ⚠️ **If you edit the Google Form, re-check those ids.** Adding, deleting or
> retitling a question can change them, and a stale id fails silently — the
> field simply arrives blank, with nothing in the UI to indicate it.
> To read the current ids: open the live form and evaluate
> `FB_PUBLIC_LOAD_DATA_[1][1]` in the console. Each question is `[id, title, …]`
> with the entry id at `[4][0][0]`. Set any entry in `FEEDBACK_PREFILL` to `""`
> to stop sending that field.

The context line under the button shows exactly what is being sent, so the
member can see it before it leaves the page.

**Known limit:** prefill describes **Scenario A only**. Someone comparing two
stations who finds a fault in Scenario B will send Scenario A's location. The
free-text answers are where that gets clarified.

**Where the answers go.** Set exactly one of two constants near the top of the
`<script>` in `index.html`:

```js
const FEEDBACK_FORM_URL = "https://forms.gle/XXXXXXXX";  // Google Form: button opens it
const FEEDBACK_ENDPOINT = "";                            // or a JSON POST URL
```

- `FEEDBACK_ENDPOINT` wins if both are set. It receives a JSON POST with every
  field above plus the auto-filled context; use Formspree, Zapier, or an Apps
  Script web app.
- If only `FEEDBACK_FORM_URL` is set, the in-page fields are hidden and the
  button opens the Google Form instead — the fields cannot submit anywhere
  without an endpoint, so showing them would be a dead end.
- If both are empty the card falls back to the public GitHub issue link, so the
  button is never dead.

**Name and email must not be routed to GitHub issues.** Those are public, and
these responses pair a person's identity with details about their own pay. Keep
the Google Form's response sheet private, and leave the form's own "Collect
email addresses" setting off — question 3 asks for it explicitly, with context.

## Accessibility & print

- Results and the comparison delta use `aria-live="polite"` so screen readers announce recalculated values.
- Every static control has a `<label for>`; every generated special-pay amount input carries an `aria-label` — including the second, per-scenario box on the COLA rows. The DOM suite derives the expected count from `SPECIALS` rather than hardcoding it.
- Print stylesheet: hides action buttons, forces exact brand color, prevents cards from splitting across pages, and appends link URLs after anchors.

## Running the tests

```
npm ci                # install the exact locked test dependency (once per clone)
npm test              # engine suite + DOM integration suite
```

`test-dom.js` parses the real `index.html` in a real DOM, executes the real
scripts, and drives the UI with dispatched events — catching anything a stubbed
DOM could hide (options never created, listeners never wired, escaping that only
looks safe as a string). If jsdom isn't installed, it exits 2 and fails the test
command with instructions to install the locked dependencies using `npm ci`.

**Not covered by either suite: visual layout.** jsdom has no renderer, so how the
page *looks* — especially on a phone — still needs a human with a browser.

The suites cover the golden case, 2026 constants, the pay
table, BAH data integrity and lookup, FICA/combat-zone/TSP behaviour, all 51
state jurisdictions, special pays, input hardening, a 1,071-combination sweep,
XSS escaping, share-link round-trip, corrupted-data resilience, accessibility,
deployment metadata, and real DOM event integration. Exit code 0 = pass. **Run
them after any change to `index.html` or `bah-data.js`, and after the yearly rate
update.**

## Verification

The calculation logic has an automated test harness approach: load `bah-data.js` + the inline script into Node with a stubbed DOM, then assert invariants (pay caps, BAH lookup vs raw data for all areas, combat/TSP/FICA behavior, all-state validity, effective-rate bounds). Re-run after any data or logic change.
