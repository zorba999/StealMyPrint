# StealMyPrint

A forensic adjudication layer for 3D-model IP, built as a GenLayer Intelligent
Contract with a React front end.

Designers register a model and its licence tier. Anyone can submit a suspicious
marketplace listing with a stake. The contract renders the listing, reads it,
and returns a **structured verdict** settled by validator consensus.

---

## Why this needs GenLayer

Almost every 3D-model licence permits selling a **printed copy** and forbids
redistributing the **file**. Which one a listing is doing comes down to a
sentence of marketing copy: "instant digital download" versus "ships in 3–5
days". That is a reading task.

A conventional smart contract cannot fetch the page, cannot read the sentence,
and cannot weigh it against a licence. GenLayer can do all three inside one
transaction, and have independent validators agree on the answer.

The verdict is therefore never a boolean. It is a matrix:

| Licence tier      | Selling the file  | Selling a print   | Both              | Unclear     |
| ----------------- | ----------------- | ----------------- | ----------------- | ----------- |
| **PERSONAL_ONLY** | `CLEAR_VIOLATION` | `CLEAR_VIOLATION` | `CLEAR_VIOLATION` | `LIKELY`    |
| **PRINTS_OK**     | `CLEAR_VIOLATION` | `NO_VIOLATION`    | `CLEAR_VIOLATION` | `GRAY_ZONE` |
| **COMMERCIAL_OK** | `NO_VIOLATION`    | `NO_VIOLATION`    | `NO_VIOLATION`    | `NO_VIOLATION` |

The `PRINTS_OK × selling a print` cell is the point of the whole system. A
keyword matcher flags it and destroys the designer's relationship with their own
printing community. This contract clears it.

---

## Deployed

| | |
| --- | --- |
| Network | GenLayer Studio Network (chain `61999`) |
| RPC | `https://studio.genlayer.com/api` |
| Contract | `0x064e61699CC0EB4f185bF14CECfd80AEdB34daCa` |
| Minimum stake | `1000000000000000` wei (0.001 GEN) |

---

## Layout

```
contracts/steal_my_print.py   the Intelligent Contract
deploy/deploy.mjs             schema check + deploy, writes deployments.json
scripts/seed.mjs              seeds demo models / probes / claims
scripts/probe*.{py,mjs}       the throwaway probes used to map the gl API
web/                          Vite + React + Tailwind + GSAP front end
```

---

## Running it

```bash
npm install
cp .env.example .env.local   # add your deploy key
node deploy/deploy.mjs --schema
```

Deploy and start the UI:

```bash
node deploy/deploy.mjs && npm --prefix web install && npm --prefix web run dev
```

`deploy.mjs` writes the new address into `deployments.json` **and**
`web/.env.local`, so the front end picks it up with no manual step.

---

## Contract API

| Method | Kind | Notes |
| --- | --- | --- |
| `register_model(title, canonical_url, license_tier)` | write | Mints a proof code |
| `verify_ownership(model_id)` | write · nondet | Renders your page, finds the code, snapshots a fingerprint |
| `probe_source(url)` | write · nondet | Pre-flight: is this URL readable at all? Cached per URL |
| `file_claim(model_id, suspect_url)` | payable · nondet | The adjudication. Verified models only; the stake is the transaction value |
| `fund_bounty(model_id, bounty_per_hit)` | payable | The deposit is the transaction value |
| `withdraw()` | write | Pays a hunter's accrued credits out to their wallet |
| `withdraw_bounty(model_id, amount)` | write | Lets an owner pull unspent bounty back |
| `get_models` / `get_claims` / `get_stats` / `get_hunter` / `get_source_probe` | view | |

### Claims only settle against verified registrations

`file_claim` refuses to adjudicate a model whose owner has not proven control of
its canonical page. Without that rule anyone could register a work they do not
own and farm verdicts against a competitor, and the console hides unverified
models from the Investigate tab for the same reason.

### Ownership proof without KYC

`register_model` returns a code such as `glp-4e00ed-1`. You paste it into your
own model description or profile bio. `verify_ownership` renders that page and
looks for it. If it is there, you control the account, so you own the listing.
No admin, no paperwork.

The same call snapshots the page text as a fingerprint, so later adjudications
keep working after the origin site goes down or changes.

### The equivalence principle

Adjudication runs in two stages inside one non-deterministic block: fetch the
page, then ask the model four separate questions (identity, nature of sale,
attribution, verdict). The result is settled with
`gl.eq_principle.prompt_comparative` under a deliberately strict principle:

> the `verdict`, `identity`, `nature` and `attribution` fields must match
> exactly; `confidence` may differ by up to 25; `reasoning` is free text.

Loosen that and everything reaches consensus, including nonsense. Tighten it and
nothing ever settles. Tuning it is most of the work.

---

## Honest limits

These were measured against the live network, not assumed.

**Large marketplaces bot-gate the validator renderer.** Printables, Thingiverse,
MakerWorld and Etsy all return HTTP `403`. Cults3D served 2.9k characters and
then started refusing once probed repeatedly. Gumroad returns **0 characters** in
`text` mode and 117k in `html` mode, but it is a single-page app.
Stripping the markup leaves no prose, and `_extract_meta` did not recover enough metadata
either, so it is adjudicated as `UNREADABLE`.

`_render_readable` therefore tries text, then html with tags stripped, then
og:/JSON-LD metadata, retrying each mode twice. Pages that survive that chain
(openscad.org, wikipedia.org) adjudicate correctly: the seeded Wikipedia claim
returns `NO_VIOLATION` at confidence 95 with reasoning that cites the page.

When a page cannot be read, the contract returns `UNREADABLE`, refunds the stake
and punishes nobody. It does not guess. `probe_source` lets a hunter find out
before committing anything.

**Realistic recall is 70–85% on reachable sources**, not 100%. Seventy percent in
ninety seconds still beats one hundred percent in six weeks.

**A verdict is evidence, not a legal ruling.** No blockchain has authority over
Etsy. The output is a fast, signed, structured evidence packet you attach to a
DMCA form, plus a public registry of repeat offenders.

**Value transfers out are debited but not credited on studionet.** `withdraw`
and `withdraw_bounty` use `emit_transfer`, and the contract balance falls by
exactly the amount released, but the recipient wallet is never credited on the
Studio sandbox. This was reproduced in isolation with `scripts/probe7.py` for
both `on="accepted"` and `on="finalized"`, so it is a property of the
environment rather than of this contract. The test asserts the contract-side
accounting, which is exact, and records the recipient side as an environment
note.

**Adjudication is slow and costs real compute.** 60–240 seconds per claim, web
rendering plus inference across every validator. That is why staking exists.

---

## Staking and bounties

`file_claim` and `fund_bounty` are payable, and the console sends the amount as
the transaction value rather than defaulting to zero.

- **Filing a claim.** The Investigate tab has a stake field, pre-filled with the
  contract's `min_stake` and validated against it, so an under-staked claim is
  blocked in the UI as well as rejected on chain. The button shows the amount it
  is about to send.
- **Funding a bounty.** The Fund a bounty tab is restricted to models you own.
  The deposit is sent as the value and lands in that model's pool; the payout per
  confirmed hit is stored alongside it.
- **Getting GEN.** A freshly generated burner holds nothing, which would make the
  payable path unreachable once `min_stake` is positive. The Studio network
  exposes `sim_fundAccount` over RPC, so the console offers a one-click faucet and
  shows the live balance, warning when it cannot cover a stake.

Amounts are parsed from decimal strings straight to `BigInt` in
`web/src/lib/units.ts`, never through `Number`, so `0.1` GEN is exactly
`100000000000000000` wei.

### End-to-end test

```bash
node test/e2e-stake-accounting.mjs
```

Deploys its own instance, then runs through the same genlayer-js path the
browser uses. It asserts that `min_stake` is enforced, that claims are refused
against an unverified registration, that `verify_ownership` succeeds against a
page the registrant controls, that a deposit lands in the pool
intact, that a properly staked claim is accepted, and that the resulting
accounting balances. Expected settlement is derived from the verdict that
actually came back rather than one assumed in advance:

```
CLEAR_VIOLATION | LIKELY -> reward = min(bounty_per_hit, pool)
                            pool -= reward ; payout = reward + stake
NO_VIOLATION             -> slashed = stake // 2
                            pool += slashed ; payout = stake - slashed
GRAY_ZONE | UNREADABLE   -> pool unchanged ; payout = stake
```

The registration it verifies points at `proof/model-1.txt` in this repository,
which carries the proof code the contract mints for model #1 of the deploying
account. `raw.githubusercontent.com` is readable by the validator renderer, so
the repo can host the proof the way a designer would host it on their own
listing.

Withdrawal is covered by a separate funded account, so a payout is not masked by
the fees the deployer would pay as both sender and recipient.

Last run: **32 passed, 0 failed, 1 environment note**.

The same flow was then driven through the browser console end to end: a burner
generated in the page, funded from the faucet, staking 0.002 GEN on a claim. The
contract recorded `stake = 2000000000000000` wei from hunter
`0x5c5636A9F12B99E3B57339BaE45c5Ef442F5347A`, returned `NO_VIOLATION` at
confidence 99, credited `1000000000000000` as the payout, moved the other half
into the model's pool, and the wallet balance fell from 1 GEN to 0.998 GEN.

---

## Front end

Vite + React + Tailwind + GSAP, deployed as a static SPA.

- **Wallet adapter** supports both an in-browser burner wallet (generated and
  held in `localStorage`, fastest way to try the flow) and an injected wallet
  such as MetaMask, which is asked to switch to chain `61999`.
- **GSAP** drives the whole motion system: `SplitText` line reveals,
  `ScrollTrigger` with a pinned horizontal process section, seamless marquees,
  magnetic buttons, scrub parallax and count-ups, all on one shared `CustomEase`.
- The **Sources** section publishes the real reachability measurements above
  rather than hiding them.

### Deploying to Vercel

Import the repo and set **Root Directory** to `web`. Vercel detects the Vite
preset and `web/vercel.json` supplies the SPA rewrite that keeps `/console`
working on a direct visit or refresh. No environment variables are required:
the contract address is compiled in as a fallback; set `VITE_CONTRACT_ADDRESS`
only to point a deployment at a different instance.

`GENLAYER_PRIVATE_KEY` and `GENLAYER_NETWORK` are for the local deploy script
and must **not** be added in Vercel. Vercel offers to import them because they
appear in `.env.example`; decline. Vite only exposes `VITE_*` to the browser, so
they would do nothing there anyway, but a private key does not belong in a
hosting dashboard.

There is deliberately no `vercel.json` at the repository root: with Root
Directory set to `web`, Vercel already runs inside `web/`, so a root-level
`buildCommand` of `cd web && …` resolves to `web/web` and the build fails.

The deploy key stays in `.env.local`, which is gitignored, and is never read by
the front end.
