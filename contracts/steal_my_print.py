# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
StealMyPrint — a forensic adjudication layer for 3D-model IP.

Designers register a model + its license tier. Hunters submit suspicious
marketplace listings with a stake. The contract renders the listing, reads it,
and issues a structured verdict through validator consensus.

The judgement is deliberately NOT a boolean. The whole point of this niche is
that most 3D-model licenses allow selling *printed objects* but forbid
redistributing the *file*. Telling those apart is the product.
"""

import json
import re
from dataclasses import dataclass

from genlayer import *

_TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
_ANY_TAG_RE = re.compile(r"<[^>]+>")


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)

# Meta tags are parsed attribute-by-attribute rather than with one big pattern,
# because `content` appears before `property` about as often as after it.
_META_TAG_RE = re.compile(r"<meta\b[^>]*>", re.I)
_ATTR_RE = re.compile(r"""(property|name|content)\s*=\s*["']([^"']*)["']""", re.I)
_WANTED_META = ("og:", "twitter:", "product:", "description", "title", "price")

_LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.S | re.I
)


def _strip_html(html: str) -> str:
    html = _TAG_RE.sub(" ", html)
    html = _ANY_TAG_RE.sub(" ", html)
    return " ".join(html.split())


def _extract_meta(html: str) -> str:
    """Pull the high-signal metadata out of a client-side rendered page.

    Marketplaces put the listing title, description and price into og: tags and
    JSON-LD product schema even when the visible DOM is built by JavaScript.
    That metadata is exactly the evidence an adjudication needs, and it is far
    more compact than the raw markup.
    """
    parts = []

    m = _TITLE_RE.search(html)
    if m:
        parts.append("TITLE: " + " ".join(m.group(1).split())[:300])

    seen = 0
    for tag in _META_TAG_RE.findall(html):
        attrs = {k.lower(): v for k, v in _ATTR_RE.findall(tag)}
        key = attrs.get("property") or attrs.get("name")
        content = attrs.get("content")
        if not key or not content or len(content) < 2:
            continue
        low = key.lower()
        if not any(low.startswith(w) or low == w for w in _WANTED_META):
            continue
        parts.append(key + ": " + " ".join(content.split())[:300])
        seen += 1
        if seen >= 24:
            break

    for block in _LD_RE.findall(html)[:3]:
        parts.append("SCHEMA: " + " ".join(block.split())[:1200])

    return " | ".join(parts)


def _render_readable(url: str) -> str:
    """Fetch a page as plain readable text.

    Two things make this harder than it looks, both measured against the live
    network rather than assumed:

    1. `mode="text"` is cheapest but returns an empty string on client-side
       rendered sites (Gumroad: 0 chars as text, 117k as html), so html is a
       fallback and we strip the tags ourselves.
    2. Large marketplaces bot-gate the renderer and will 403 one call and serve
       the page on the next, so each mode gets a second attempt.

    Raises on total failure — callers turn that into an UNREADABLE verdict
    rather than guessing.
    """
    last = None
    raw_html = ""

    for mode in ("text", "html"):
        for _ in range(2):
            try:
                page = gl.nondet.web.render(url, mode=mode)
            except Exception as exc:
                last = exc
                continue

            if mode == "text":
                text = " ".join(page.split())
            else:
                raw_html = page
                text = _strip_html(page)

            if len(text.strip()) >= 120:
                return text
            last = Exception("no readable text in mode=" + mode)

    # Single-page apps keep their content in script JSON and meta tags, so
    # stripping the markup leaves nothing. The metadata is still there, and it
    # is the part that actually describes the listing.
    if raw_html:
        meta = _extract_meta(raw_html)
        if len(meta) >= 80:
            return meta

    raise Exception(str(last)[:200] if last else "unreachable")

# --- license tiers -----------------------------------------------------------
# 0  PERSONAL_ONLY  : no commercial exploitation of any kind
# 1  PRINTS_OK      : selling physical prints allowed, redistributing file is not
# 2  COMMERCIAL_OK  : commercial use permitted; only attribution can be breached
LICENSE_LABELS = {
    0: "PERSONAL_ONLY",
    1: "PRINTS_OK",
    2: "COMMERCIAL_OK",
}

MAX_PAGE_CHARS = 6000
MAX_FINGERPRINT_CHARS = 1200


@allow_storage
@dataclass
class Model:
    id: u256
    owner: Address
    title: str
    canonical_url: str
    license_tier: u256
    proof_code: str
    verified: bool
    fingerprint: str
    bounty_pool: u256
    bounty_per_hit: u256
    claims_filed: u256
    confirmed_thefts: u256


@allow_storage
@dataclass
class Claim:
    id: u256
    model_id: u256
    hunter: Address
    suspect_url: str
    verdict: str
    identity: str
    nature: str
    attribution: str
    confidence: u256
    reasoning: str
    evidence_digest: str
    stake: u256
    payout: u256


class StealMyPrint(gl.Contract):
    # --- storage -------------------------------------------------------------
    models: TreeMap[u256, Model]
    model_ids: DynArray[u256]
    model_count: u256

    claims: TreeMap[u256, Claim]
    claim_ids: DynArray[u256]
    claim_count: u256

    claims_by_model: TreeMap[u256, DynArray[u256]]
    models_by_owner: TreeMap[Address, DynArray[u256]]

    # hunter ledger
    hunter_score: TreeMap[Address, u256]
    hunter_hits: TreeMap[Address, u256]
    hunter_credits: TreeMap[Address, u256]

    # url -> claim id, so the same listing is not adjudicated twice
    seen_urls: TreeMap[str, u256]

    # url -> cached reachability probe (JSON)
    source_probes: TreeMap[str, str]

    min_stake: u256
    confirmed_total: u256

    def __init__(self, min_stake: int = 0):
        self.model_count = 0
        self.claim_count = 0
        self.min_stake = u256(min_stake)
        self.confirmed_total = 0

    # =========================================================================
    # registry
    # =========================================================================
    @gl.public.write
    def register_model(
        self, title: str, canonical_url: str, license_tier: int
    ) -> None:
        if license_tier not in (0, 1, 2):
            raise Exception("license_tier must be 0, 1 or 2")
        if not canonical_url.startswith("http"):
            raise Exception("canonical_url must be an http(s) URL")
        if len(title.strip()) == 0:
            raise Exception("title required")

        sender = gl.message.sender_address
        mid = u256(self.model_count + 1)
        self.model_count = mid

        # Ownership proof code — the designer pastes this into the description
        # or bio of the page they claim to control. No KYC, no admin.
        proof_code = "glp-" + sender.as_hex[2:8].lower() + "-" + str(int(mid))

        self.models[mid] = Model(
            id=mid,
            owner=sender,
            title=title[:160],
            canonical_url=canonical_url[:400],
            license_tier=u256(license_tier),
            proof_code=proof_code,
            verified=False,
            fingerprint="",
            bounty_pool=u256(0),
            bounty_per_hit=u256(0),
            claims_filed=u256(0),
            confirmed_thefts=u256(0),
        )
        self.model_ids.append(mid)
        self.models_by_owner.get_or_insert_default(sender).append(mid)
        self.claims_by_model.get_or_insert_default(mid)

    @gl.public.write
    def verify_ownership(self, model_id: int) -> None:
        """Render the canonical page and look for the proof code.

        Doubles as fingerprint capture: we snapshot the page text once, so
        later adjudications do not depend on the origin site staying up.
        """
        mid = u256(model_id)
        if mid not in self.models:
            raise Exception("unknown model")
        model = self.models[mid]
        if model.verified:
            raise Exception("already verified")

        url = model.canonical_url
        code = model.proof_code

        def probe() -> str:
            try:
                page = _render_readable(url)
            except Exception as exc:
                return json.dumps(
                    {"reachable": False, "found": False, "fp": "",
                     "err": str(exc)[:160]},
                    sort_keys=True,
                )
            if len(page.strip()) < 40:
                return json.dumps(
                    {"reachable": False, "found": False, "fp": "",
                     "err": "page returned no readable text"},
                    sort_keys=True,
                )
            found = code.lower() in page.lower()
            return json.dumps(
                {
                    "reachable": True,
                    "found": found,
                    "fp": page[:MAX_FINGERPRINT_CHARS],
                    "err": "",
                },
                sort_keys=True,
            )

        raw = gl.eq_principle.prompt_comparative(
            probe,
            principle=(
                "Both outputs are JSON. They must agree exactly on the boolean "
                "fields 'reachable' and 'found'. The 'fp' field is a snapshot of "
                "page text and may differ in wording, whitespace or length as "
                "long as both describe the same web page. The 'err' field may "
                "differ freely."
            ),
        )
        data = json.loads(raw)

        if not data.get("reachable"):
            raise Exception("canonical page unreachable: " + str(data.get("err", ""))[:120])
        if not data.get("found"):
            raise Exception(
                "proof code " + code + " not found on the page — paste it into "
                "the model description or your profile bio, then retry"
            )

        model.verified = True
        model.fingerprint = str(data.get("fp", ""))[:MAX_FINGERPRINT_CHARS]

    @gl.public.write
    def probe_source(self, url: str) -> None:
        """Pre-flight: can this URL be adjudicated at all?

        Marketplaces bot-gate the renderer, so a hunter should be able to find
        out that a listing is unreadable *before* staking on it. The result is
        cached per URL so the whole registry benefits from one probe.
        """
        if not url.startswith("http"):
            raise Exception("url must be an http(s) URL")

        def probe() -> str:
            try:
                page = _render_readable(url)
            except Exception as exc:
                return json.dumps(
                    {"readable": False, "chars": 0, "note": str(exc)[:180]},
                    sort_keys=True,
                )
            return json.dumps(
                {"readable": True, "chars": len(page), "note": page[:180]},
                sort_keys=True,
            )

        raw = gl.eq_principle.prompt_comparative(
            probe,
            principle=(
                "Both outputs are JSON. They must agree exactly on the boolean "
                "field 'readable'. The 'chars' count may differ by any amount "
                "and 'note' is free text that may be worded differently."
            ),
        )
        self.source_probes[url.strip().lower()[:400]] = raw

    @gl.public.view
    def get_source_probe(self, url: str) -> str:
        return self.source_probes.get(url.strip().lower()[:400], "")

    @gl.public.write.payable
    def fund_bounty(self, model_id: int, bounty_per_hit: int) -> None:
        mid = u256(model_id)
        if mid not in self.models:
            raise Exception("unknown model")
        model = self.models[mid]
        if model.owner != gl.message.sender_address:
            raise Exception("only the model owner can fund the bounty")

        model.bounty_pool = u256(int(model.bounty_pool) + int(gl.message.value))
        model.bounty_per_hit = u256(bounty_per_hit)

    # =========================================================================
    # settlement
    # =========================================================================
    @gl.public.write
    def withdraw(self) -> None:
        """Pay a hunter's accrued credits out to their wallet.

        The ledger is cleared before the transfer is emitted, so a re-entrant
        call finds nothing left to claim.
        """
        sender = gl.message.sender_address
        amount = int(self.hunter_credits.get(sender, u256(0)))
        if amount == 0:
            raise Exception("no credits to withdraw")

        self.hunter_credits[sender] = u256(0)
        gl.get_contract_at(sender).emit_transfer(value=u256(amount))

    @gl.public.write
    def withdraw_bounty(self, model_id: int, amount: int) -> None:
        """Let an owner pull unspent bounty back out of the pool."""
        mid = u256(model_id)
        if mid not in self.models:
            raise Exception("unknown model")

        model = self.models[mid]
        if model.owner != gl.message.sender_address:
            raise Exception("only the model owner can withdraw its bounty")

        want = int(amount)
        pool = int(model.bounty_pool)
        if want <= 0 or want > pool:
            raise Exception(
                "amount must be between 1 and the pool balance of " + str(pool)
            )

        model.bounty_pool = u256(pool - want)
        gl.get_contract_at(model.owner).emit_transfer(value=u256(want))

    # =========================================================================
    # adjudication
    # =========================================================================
    @gl.public.write.payable
    def file_claim(self, model_id: int, suspect_url: str) -> None:
        mid = u256(model_id)
        if mid not in self.models:
            raise Exception("unknown model")
        if not suspect_url.startswith("http"):
            raise Exception("suspect_url must be an http(s) URL")

        model = self.models[mid]

        # An unverified registration proves nothing: anyone could register a
        # work they do not own and farm verdicts against a competitor. Refuse
        # to adjudicate until ownership has been demonstrated.
        if not model.verified:
            raise Exception(
                "model #" + str(int(mid)) + " is not verified. Its owner must "
                "prove control of " + model.canonical_url + " before claims can "
                "be adjudicated against it"
            )

        stake = int(gl.message.value)
        if stake < int(self.min_stake):
            raise Exception("stake below min_stake")

        key = suspect_url.strip().lower()[:400]
        if key in self.seen_urls:
            raise Exception(
                "this listing was already adjudicated in claim #"
                + str(int(self.seen_urls[key]))
            )

        hunter = gl.message.sender_address

        tier = int(model.license_tier)
        tier_label = LICENSE_LABELS[tier]
        fingerprint = model.fingerprint if model.fingerprint else model.title

        verdict = self._adjudicate(
            suspect_url=suspect_url,
            model_title=model.title,
            model_url=model.canonical_url,
            fingerprint=fingerprint,
            tier=tier,
            tier_label=tier_label,
        )

        cid = u256(self.claim_count + 1)
        self.claim_count = cid

        payout = 0
        v = verdict["verdict"]

        if v == "CLEAR_VIOLATION" or v == "LIKELY":
            weight = 3 if v == "CLEAR_VIOLATION" else 1
            self.hunter_score[hunter] = u256(
                int(self.hunter_score.get(hunter, u256(0))) + weight
            )
            self.hunter_hits[hunter] = u256(
                int(self.hunter_hits.get(hunter, u256(0))) + 1
            )
            model.confirmed_thefts = u256(int(model.confirmed_thefts) + 1)
            self.confirmed_total = u256(int(self.confirmed_total) + 1)

            reward = min(int(model.bounty_per_hit), int(model.bounty_pool))
            model.bounty_pool = u256(int(model.bounty_pool) - reward)
            payout = reward + stake  # stake is returned on a good-faith hit
            self.hunter_credits[hunter] = u256(
                int(self.hunter_credits.get(hunter, u256(0))) + payout
            )

        elif v == "NO_VIOLATION":
            # bad report: half the stake is forfeited into the model's pool
            slashed = stake // 2
            model.bounty_pool = u256(int(model.bounty_pool) + slashed)
            payout = stake - slashed
            self.hunter_credits[hunter] = u256(
                int(self.hunter_credits.get(hunter, u256(0))) + payout
            )

        else:
            # GRAY_ZONE or UNREADABLE — nobody is punished, stake comes back
            payout = stake
            self.hunter_credits[hunter] = u256(
                int(self.hunter_credits.get(hunter, u256(0))) + payout
            )

        self.claims[cid] = Claim(
            id=cid,
            model_id=mid,
            hunter=hunter,
            suspect_url=suspect_url[:400],
            verdict=v,
            identity=verdict["identity"],
            nature=verdict["nature"],
            attribution=verdict["attribution"],
            confidence=u256(int(verdict["confidence"])),
            reasoning=verdict["reasoning"][:900],
            evidence_digest=verdict["evidence_digest"][:400],
            stake=u256(stake),
            payout=u256(payout),
        )
        self.claim_ids.append(cid)
        self.claims_by_model.get_or_insert_default(mid).append(cid)
        self.seen_urls[key] = cid
        model.claims_filed = u256(int(model.claims_filed) + 1)

    def _adjudicate(
        self,
        suspect_url: str,
        model_title: str,
        model_url: str,
        fingerprint: str,
        tier: int,
        tier_label: str,
    ) -> dict:
        """Stage 1 fetch + stage 2 judgement, settled by comparative consensus."""

        rules = {
            0: (
                "PERSONAL_ONLY: any commercial exploitation is a violation — "
                "selling the file AND selling printed copies are both breaches."
            ),
            1: (
                "PRINTS_OK: selling physical printed copies is ALLOWED and is "
                "NOT a violation. Redistributing, reselling or bundling the "
                "digital file (STL/OBJ/3MF/STEP, 'instant download', 'digital "
                "file', 'files included') IS a violation."
            ),
            2: (
                "COMMERCIAL_OK: commercial use is permitted. Only a missing "
                "credit to the original designer can be a (minor) breach."
            ),
        }[tier]

        def investigate() -> str:
            try:
                page = _render_readable(suspect_url)
            except Exception as exc:
                return json.dumps(
                    {
                        "verdict": "UNREADABLE",
                        "identity": "UNKNOWN",
                        "nature": "UNCLEAR",
                        "attribution": "UNKNOWN",
                        "confidence": 0,
                        "reasoning": (
                            "The listing could not be retrieved, so no judgement "
                            "was made. Cause: " + str(exc)[:150]
                        ),
                        "evidence_digest": "fetch-failed",
                    },
                    sort_keys=True,
                )

            clean = page[:MAX_PAGE_CHARS]

            if len(clean) < 120:
                return json.dumps(
                    {
                        "verdict": "UNREADABLE",
                        "identity": "UNKNOWN",
                        "nature": "UNCLEAR",
                        "attribution": "UNKNOWN",
                        "confidence": 0,
                        "reasoning": (
                            "The page returned almost no readable text (likely "
                            "client-side rendered or bot-gated). Refusing to "
                            "judge on empty evidence."
                        ),
                        "evidence_digest": "empty-page",
                    },
                    sort_keys=True,
                )

            prompt = f"""You are an IP forensics analyst for 3D-printable models.

ORIGINAL WORK
  Title: {model_title}
  Source: {model_url}
  License tier: {tier_label}
  License rule: {rules}
  Reference text captured from the original page:
  \"\"\"{fingerprint}\"\"\"

SUSPECT LISTING
  URL: {suspect_url}
  Page text:
  \"\"\"{clean}\"\"\"

Answer these four questions independently.

Q1 identity — is the item offered the same work as the original?
   SAME       : unmistakably the same model
   DERIVATIVE : clearly built from it (rescaled, remixed, kitbashed)
   SIMILAR    : same genre/subject but plausibly independent work
   DIFFERENT  : unrelated
   UNKNOWN    : the page does not say enough

Q2 nature — what is actually being sold?
   DIGITAL_FILE   : a downloadable model file (STL/OBJ/3MF/STEP, "instant
                    download", "digital product", "files included")
   PHYSICAL_PRINT : a printed physical object that ships to the buyer
   BOTH           : both are offered
   UNCLEAR        : cannot tell

Q3 attribution — is the original designer credited on the page?
   PRESENT / ABSENT / UNKNOWN

Q4 verdict — apply the license rule to Q1+Q2+Q3.
   CLEAR_VIOLATION : Q1 is SAME or DERIVATIVE and the rule is plainly broken
   LIKELY          : the rule is probably broken but evidence is partial
   GRAY_ZONE       : genuinely arguable, or the page is ambiguous
   NO_VIOLATION    : permitted by the license, or not the same work

The page above was fetched successfully, so you always have evidence. If it
shows an unrelated item, or no sale of the original work at all, that is
NO_VIOLATION with identity DIFFERENT — it is never "unreadable".

Be conservative. If the page does not clearly show the work is the same,
do not return CLEAR_VIOLATION. A physical print sold under PRINTS_OK is
NOT a violation — say NO_VIOLATION.

Respond with ONLY this JSON, no prose, no code fences:
{{
  "verdict": "CLEAR_VIOLATION|LIKELY|GRAY_ZONE|NO_VIOLATION",
  "identity": "SAME|DERIVATIVE|SIMILAR|DIFFERENT|UNKNOWN",
  "nature": "DIGITAL_FILE|PHYSICAL_PRINT|BOTH|UNCLEAR",
  "attribution": "PRESENT|ABSENT|UNKNOWN",
  "confidence": 0,
  "reasoning": "two or three sentences citing what you saw on the page",
  "evidence_digest": "the listing title and price exactly as shown"
}}"""

            raw = gl.nondet.exec_prompt(prompt)
            raw = raw.replace("```json", "").replace("```", "").strip()
            start = raw.find("{")
            end = raw.rfind("}")
            if start == -1 or end == -1:
                raise Exception("model did not return JSON")
            data = json.loads(raw[start : end + 1])

            verdict = str(data.get("verdict", "GRAY_ZONE")).upper()
            if verdict == "UNREADABLE":
                # the page WAS fetched, so this means the model is unsure
                verdict = "GRAY_ZONE"

            normalised = {
                "verdict": verdict,
                "identity": str(data.get("identity", "UNKNOWN")).upper(),
                "nature": str(data.get("nature", "UNCLEAR")).upper(),
                "attribution": str(data.get("attribution", "UNKNOWN")).upper(),
                "confidence": max(0, min(100, int(data.get("confidence", 0)))),
                "reasoning": str(data.get("reasoning", ""))[:900],
                "evidence_digest": str(data.get("evidence_digest", ""))[:400],
            }
            return json.dumps(normalised, sort_keys=True)

        raw = gl.eq_principle.prompt_comparative(
            investigate,
            principle=(
                "Both outputs are JSON verdicts about the same listing. They are "
                "equivalent ONLY IF the 'verdict', 'identity', 'nature' and "
                "'attribution' fields match exactly. Treat CLEAR_VIOLATION and "
                "LIKELY as different values — do not merge them. The "
                "'confidence' numbers may differ by up to 25 points. The "
                "'reasoning' and 'evidence_digest' fields are free text and may "
                "be worded completely differently as long as they describe the "
                "same listing and support the same verdict."
            ),
        )

        data = json.loads(raw)
        valid_verdicts = (
            "CLEAR_VIOLATION",
            "LIKELY",
            "GRAY_ZONE",
            "NO_VIOLATION",
            "UNREADABLE",
        )
        if data.get("verdict") not in valid_verdicts:
            data["verdict"] = "GRAY_ZONE"
        for field, default in (
            ("identity", "UNKNOWN"),
            ("nature", "UNCLEAR"),
            ("attribution", "UNKNOWN"),
            ("reasoning", ""),
            ("evidence_digest", ""),
        ):
            if not isinstance(data.get(field), str):
                data[field] = default
        try:
            data["confidence"] = max(0, min(100, int(data.get("confidence", 0))))
        except Exception:
            data["confidence"] = 0
        return data

    # =========================================================================
    # views
    # =========================================================================
    def _model_dict(self, m: Model) -> dict:
        return {
            "id": int(m.id),
            "owner": m.owner.as_hex,
            "title": m.title,
            "canonical_url": m.canonical_url,
            "license_tier": int(m.license_tier),
            "license_label": LICENSE_LABELS[int(m.license_tier)],
            "proof_code": m.proof_code,
            "verified": m.verified,
            "has_fingerprint": len(m.fingerprint) > 0,
            "bounty_pool": str(int(m.bounty_pool)),
            "bounty_per_hit": str(int(m.bounty_per_hit)),
            "claims_filed": int(m.claims_filed),
            "confirmed_thefts": int(m.confirmed_thefts),
        }

    def _claim_dict(self, c: Claim) -> dict:
        return {
            "id": int(c.id),
            "model_id": int(c.model_id),
            "hunter": c.hunter.as_hex,
            "suspect_url": c.suspect_url,
            "verdict": c.verdict,
            "identity": c.identity,
            "nature": c.nature,
            "attribution": c.attribution,
            "confidence": int(c.confidence),
            "reasoning": c.reasoning,
            "evidence_digest": c.evidence_digest,
            "stake": str(int(c.stake)),
            "payout": str(int(c.payout)),
        }

    @gl.public.view
    def get_models(self) -> list:
        return [self._model_dict(self.models[i]) for i in self.model_ids]

    @gl.public.view
    def get_model(self, model_id: int) -> dict:
        mid = u256(model_id)
        if mid not in self.models:
            raise Exception("unknown model")
        return self._model_dict(self.models[mid])

    @gl.public.view
    def get_claims(self) -> list:
        return [self._claim_dict(self.claims[i]) for i in self.claim_ids]

    @gl.public.view
    def get_claims_for_model(self, model_id: int) -> list:
        mid = u256(model_id)
        if mid not in self.claims_by_model:
            return []
        return [self._claim_dict(self.claims[i]) for i in self.claims_by_model[mid]]

    @gl.public.view
    def get_models_by_owner(self, owner: str) -> list:
        addr = Address(owner)
        if addr not in self.models_by_owner:
            return []
        return [self._model_dict(self.models[i]) for i in self.models_by_owner[addr]]

    @gl.public.view
    def get_hunter(self, addr: str) -> dict:
        a = Address(addr)
        return {
            "address": a.as_hex,
            "score": int(self.hunter_score.get(a, u256(0))),
            "hits": int(self.hunter_hits.get(a, u256(0))),
            "credits": str(int(self.hunter_credits.get(a, u256(0)))),
        }

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "models": int(self.model_count),
            "claims": int(self.claim_count),
            "confirmed": int(self.confirmed_total),
            "min_stake": str(int(self.min_stake)),
            "verified_models": sum(
                1 for i in self.model_ids if self.models[i].verified
            ),
        }
