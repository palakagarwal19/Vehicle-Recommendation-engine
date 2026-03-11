"""
greenwashing.py
---------------
Greenwashing risk detection module for a vehicle lifecycle emissions platform.

Evaluates marketing claims against real lifecycle CO₂ data (g/km) and flags
misleading or unsubstantiated environmental language, consistent with:
  - EU Empowering Consumers for the Green Transition Directive (2024/825),
    in force March 2024, binding from September 2026.
  - EU Green Claims Directive (proposed; trilogue ongoing as of 2025).
  - UK ASA guidance on advertising electric and hybrid vehicles (2024).
  - Germany BGH ruling on "klimaneutral" (27 June 2024).

FIX LOG (v2)
------------
1. No-rule-match now returns UNVERIFIED / CAUTION, NOT "potentially misleading".
2. Transparency score: starts at 100, deducted per finding severity.
   Zero findings → score 90–100 (high transparency), not 17.
3. Overall risk driven only by actual rule matches; aspirational/corporate
   language not matched by any rule stays CAUTION at worst.
4. EV operational emissions threshold raised:
     ≤ 50 g/km  → no structural flag (low-carbon grid)
     51–100 g/km → CAUTION structural note
     > 100 g/km → WARNING (carbon-heavy grid dependency)
5. Aspirational claims ("transition to zero-emissions future",
   "commitment to carbon neutrality") are correctly classified as
   corporate/aspirational language, NOT product claims.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------

ZLEV_UPPER_THRESHOLD_G_PER_KM        = 50.0
ICE_REFERENCE_LIFECYCLE_G_PER_KM     = 220.0
EV_REFERENCE_LIFECYCLE_G_PER_KM      = 75.0
HEV_LIFECYCLE_REDUCTION_VS_ICE       = 0.21
PHEV_LIFECYCLE_REDUCTION_VS_ICE      = 0.26

LOW_LIFECYCLE_THRESHOLD    = EV_REFERENCE_LIFECYCLE_G_PER_KM * 1.20   # ~90 g/km
MEDIUM_LIFECYCLE_THRESHOLD = ICE_REFERENCE_LIFECYCLE_G_PER_KM * 0.50  # ~110 g/km

# FIX 4: EV operational thresholds
# ≤ 50 g/km  → clean grid, no flag
# 51–100 g/km → moderate grid, informational note only (CAUTION)
# > 100 g/km  → carbon-heavy grid, structural WARNING
EV_OPERATIONAL_LOW_THRESHOLD    = 50.0   # g/km — no flag below this
EV_OPERATIONAL_MEDIUM_THRESHOLD = 100.0  # g/km — WARNING above this


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class RiskLevel(str, Enum):
    SAFE        = "SAFE"       # Claim well-supported by the data.
    CAUTION     = "CAUTION"    # Plausible but requires qualification.
    WARNING     = "WARNING"    # Misleading; regulatory risk is high.
    VIOLATION   = "VIOLATION"  # Contradicted by data; likely illegal.


class VehicleType(str, Enum):
    EV   = "EV"
    HEV  = "HEV"
    PHEV = "PHEV"
    ICE  = "ICE"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ClaimFinding:
    """Result of evaluating a single marketing claim."""
    claim:      str
    risk_level: RiskLevel
    reason:     str
    suggestion: Optional[str] = None
    # FIX 1/5: distinguish matched rules from unverified / aspirational
    is_unverified:   bool = False  # True  → no rule matched (unverified, not misleading)
    is_aspirational: bool = False  # True  → corporate/future language (not a product claim)


@dataclass
class GreenwashingReport:
    """Aggregated greenwashing evaluation for a vehicle."""
    brand:                  str
    model:                  str
    vehicle_type:           str
    total_g_per_km:         float
    operational_g_per_km:   float
    manufacturing_g_per_km: float   # per-km rate (display)
    manufacturing_total_kg: float   # fixed one-time cost (source of truth)
    recycling_kg:           float   # fixed end-of-life cost
    overall_risk:           RiskLevel
    transparency_score:     int
    findings:               list[ClaimFinding] = field(default_factory=list)
    structural_flags:       list[str]          = field(default_factory=list)
    misleading_claims:      list[dict]         = field(default_factory=list)

    def summary(self) -> str:
        lines = [
            f"=== Greenwashing Report: {self.brand} {self.model} ({self.vehicle_type}) ===",
            f"  Lifecycle total   : {self.total_g_per_km:.1f} g CO₂/km",
            f"  Operational       : {self.operational_g_per_km:.1f} g CO₂/km",
            f"  Manufacturing     : {self.manufacturing_g_per_km:.1f} g CO₂/km  ({self.manufacturing_total_kg:.0f} kg fixed)",
            f"  Transparency score: {self.transparency_score}/100",
            f"  Overall risk      : {self.overall_risk.value}",
            "",
        ]
        if self.structural_flags:
            lines.append("Structural flags:")
            for flag in self.structural_flags:
                lines.append(f"  ⚑  {flag}")
            lines.append("")
        if self.findings:
            lines.append("Claim findings:")
            for f in self.findings:
                sym = {"SAFE":"✔","CAUTION":"⚠","WARNING":"✘","VIOLATION":"✖"}[f.risk_level.value]
                tag = " [aspirational]" if f.is_aspirational else (" [unverified]" if f.is_unverified else "")
                lines.append(f"  {sym} [{f.risk_level.value}{tag}] '{f.claim}'")
                lines.append(f"       Reason    : {f.reason}")
                if f.suggestion:
                    lines.append(f"       Suggestion: {f.suggestion}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Score calculation
# FIX 2: Transparent, additive penalty model.
#   Base: 100
#   VIOLATION: −25 each
#   WARNING:   −15 each
#   CAUTION:   −5 each  (only if rule-matched, not unverified/aspirational)
#   Structural flag: −5 each
#   Floor: 10
# ---------------------------------------------------------------------------

def _compute_transparency_score(
    findings: list[ClaimFinding],
    structural_flags: list[str],
) -> int:
    score = 100
    for f in findings:
        if f.is_aspirational or f.is_unverified:
            continue  # aspirational / unverified claims don't penalise score
        if f.risk_level == RiskLevel.VIOLATION:
            score -= 25
        elif f.risk_level == RiskLevel.WARNING:
            score -= 15
        elif f.risk_level == RiskLevel.CAUTION:
            score -= 5
    for _ in structural_flags:
        score -= 5
    return max(10, score)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _lifecycle_intensity_grade(total_g: float) -> str:
    if total_g <= LOW_LIFECYCLE_THRESHOLD:
        return "LOW"
    if total_g <= MEDIUM_LIFECYCLE_THRESHOLD:
        return "MEDIUM"
    return "HIGH"


def _operational_share(lifecycle: dict) -> float:
    total = lifecycle["total_g_per_km"]
    return 0.0 if total <= 0 else lifecycle["operational_g_per_km"] / total


def _manufacturing_share(lifecycle: dict) -> float:
    total = lifecycle["total_g_per_km"]
    return 0.0 if total <= 0 else lifecycle["manufacturing_g_per_km"] / total


def _vehicle_type_enum(raw: str) -> VehicleType:
    try:
        return VehicleType(raw.upper())
    except ValueError:
        raise ValueError(
            f"Unknown vehicle_type '{raw}'. Must be one of: EV, HEV, PHEV, ICE."
        )


# ---------------------------------------------------------------------------
# Aspirational / corporate claim detector
# FIX 3 & 5: These are company-level statements, not product claims.
# They should be noted as aspirational, not flagged as misleading.
# ---------------------------------------------------------------------------

_ASPIRATIONAL_PHRASES = (
    "transition to a zero-emissions",
    "commitment to",
    "committed to",
    "working towards",
    "goal of carbon",
    "journey to",
    "pathway to",
    "vision of",
    "aspire to",
    "mission to",
    "pledge to",
    "by 2030", "by 2035", "by 2040", "by 2050",
    "carbon neutrality by",
    "net zero by",
    "achieve carbon",
    "achieving carbon",
)

_HISTORICAL_FACT_PHRASES = (
    "first all-electric",
    "first electric",
    "first hybrid",
    "first production",
    "pioneered",
    "introduced in",
    "launched in",
)

def _is_aspirational(claim: str) -> bool:
    cl = claim.lower()
    return any(p in cl for p in _ASPIRATIONAL_PHRASES)

def _is_historical_fact(claim: str) -> bool:
    cl = claim.lower()
    return any(p in cl for p in _HISTORICAL_FACT_PHRASES)


# ---------------------------------------------------------------------------
# Structural / data-level checks
# ---------------------------------------------------------------------------

def _check_structural_consistency(
    lifecycle: dict,
    vehicle_meta: dict,
) -> list[str]:
    """
    Data-integrity / structural greenwashing flags.
    FIX 4: EV operational threshold is now 50 / 100 g/km, not 10 g/km.
    """
    flags: list[str] = []
    pt           = _vehicle_type_enum(vehicle_meta["vehicle_type"])
    total             = lifecycle["total_g_per_km"]
    operational       = lifecycle["operational_g_per_km"]
    manufacturing     = lifecycle["manufacturing_g_per_km"]   # per-km (for ratios)
    manufacturing_kg  = lifecycle.get("manufacturing_total_kg", 0.0)  # fixed kg
    recycling_kg_val  = lifecycle.get("recycling_kg", 0.0)

    # 1. EV operational emissions — FIX 4
    if pt == VehicleType.EV:
        if operational > EV_OPERATIONAL_MEDIUM_THRESHOLD:
            flags.append(
                f"EV with high operational emissions ({operational:.1f} g/km) indicating "
                "a carbon-intensive electricity grid. Any 'zero emissions' claim must be "
                "scoped to tailpipe only and must disclose grid dependency "
                "(UK ASA 2024; EU EmpCo Directive 2024/825)."
            )
        elif operational > EV_OPERATIONAL_LOW_THRESHOLD:
            flags.append(
                f"EV operational emissions: {operational:.1f} g/km (moderate grid intensity). "
                "Consider disclosing grid carbon dependency alongside any emissions claims."
            )
        # ≤ 50 g/km: low-carbon grid — no structural flag needed

    # 2. Manufacturing dominance for EVs
    # Use fixed manufacturing_total_kg vs total lifecycle kg for accurate share.
    # total_lifecycle_kg = total_g_per_km * LIFETIME_KM / 1000
    LIFETIME_KM = 278_600
    if pt == VehicleType.EV and total > 0 and manufacturing_kg > 0:
        total_lifecycle_kg = total * LIFETIME_KM / 1000
        mfg_share = manufacturing_kg / total_lifecycle_kg if total_lifecycle_kg > 0 else 0
        if mfg_share > 0.70:
            flags.append(
                f"Manufacturing accounts for {mfg_share:.0%} of lifecycle emissions "
                f"({manufacturing_kg:.0f} kg fixed cost). "
                "Claims focusing exclusively on operational ('zero tailpipe') emissions "
                "omit the majority of this vehicle's climate impact — selective disclosure "
                "flagged by the EU Green Claims Directive."
            )

    # 3. PHEV / HEV optimistic figures
    if pt in (VehicleType.PHEV, VehicleType.HEV):
        expected_min = ICE_REFERENCE_LIFECYCLE_G_PER_KM * (
            1 - (PHEV_LIFECYCLE_REDUCTION_VS_ICE if pt == VehicleType.PHEV else HEV_LIFECYCLE_REDUCTION_VS_ICE)
        ) * 0.60
        if total < expected_min:
            flags.append(
                f"{pt.value} lifecycle figure ({total:.1f} g/km) is unusually low. "
                "Verify real-world charging behaviour is reflected (not just WLTP electric range)."
            )

    # 4. ICE below credible floor
    if pt == VehicleType.ICE and total < 100.0:
        flags.append(
            f"ICE vehicle lifecycle of {total:.1f} g/km is below the credible floor. "
            "Confirm LCA scope includes fuel upstream (WTW) and manufacturing."
        )

    # 5. Data integrity — compare per-km components
    recycling_g_per_km = lifecycle.get("recycling_g_per_km", 0.0)
    component_sum = operational + manufacturing + recycling_g_per_km
    if component_sum > total * 1.05:   # 5% tolerance (rounding across 3 components)
        flags.append(
            f"Data integrity: operational ({operational:.1f}) + manufacturing "
            f"({manufacturing:.1f}) + recycling ({recycling_g_per_km:.1f}) "
            f"= {component_sum:.1f} g/km exceeds reported total ({total:.1f} g/km). "
            "LCA figures may be inconsistent."
        )

    return flags


# ---------------------------------------------------------------------------
# Per-claim evaluation rules
# ---------------------------------------------------------------------------

def _rule_zero_emissions(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    'Zero emissions', 'emission-free', 'no emissions'.
    Only valid for tailpipe scope on a BEV on a clean grid.
    BMW / MG ASA ruling (Feb 2024).
    FIX 4: operational ≤ 50 g/km is acceptable for a clean-grid EV.
    """
    keywords = ("zero emission", "emission-free", "no emission", "emissionless",
                 "zero tailpipe")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt          = _vehicle_type_enum(meta["vehicle_type"])
    total       = lifecycle["total_g_per_km"]
    operational = lifecycle["operational_g_per_km"]

    if pt != VehicleType.EV:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=(
                f"'{claim}' applied to a {pt.value} vehicle is factually incorrect. "
                f"Operational: {operational:.1f} g/km; lifecycle total: {total:.1f} g/km. "
                "EU EmpCo Directive (2024/825) and UK ASA guidance prohibit "
                "zero-emission claims for combustion vehicles."
            ),
            suggestion="Replace with a specific scoped statement, e.g. 'Up to X% lower lifecycle CO₂ vs equivalent petrol car.'",
        )

    # FIX 4: only flag if operational > 50 g/km (carbon-heavy grid)
    if operational > EV_OPERATIONAL_LOW_THRESHOLD:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"This EV has operational emissions of {operational:.1f} g/km (carbon-intensive grid). "
                "An unqualified 'zero emissions' claim is misleading (UK ASA BMW/MG ruling, Feb 2024). "
                "The claim must disclose tailpipe scope and grid dependency."
            ),
            suggestion="Qualify as 'zero tailpipe emissions' and add: 'Actual CO₂ varies with electricity source.'",
        )

    if total > 20.0:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.CAUTION,
            reason=(
                f"Tailpipe emissions are effectively zero, but lifecycle total is "
                f"{total:.1f} g/km (manufacturing-dominated). An unqualified 'zero emissions' "
                "claim risks implying full lifecycle zero, which is false."
            ),
            suggestion=f"Scope the claim: 'Zero tailpipe emissions. Full lifecycle: {total:.0f} g CO₂/km.'",
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.SAFE,
        reason=(
            f"Operational: {operational:.1f} g/km; lifecycle: {total:.1f} g/km. "
            "Claim is supportable if scoped to tailpipe with grid-source disclosure."
        ),
        suggestion="Add tailpipe scope qualifier for full regulatory safety.",
    )


def _rule_zero_emissions_performance(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    FIX: 'high-performance with zero emissions' / 'performance thrills with zero emissions'.
    Specific to the pattern of coupling performance language with a zero-emissions claim.
    This is misleading when lifecycle or operational emissions are non-zero.
    """
    keywords = ("zero emission", "zero-emission")
    perf_keywords = ("performance", "thrill", "sport", "power", "exhilarating",
                     "exciting", "dynamic", "fast", "acceleration")
    cl = claim.lower()
    has_zero = any(k in cl for k in keywords)
    has_perf = any(k in cl for k in perf_keywords)

    if not (has_zero and has_perf):
        return None

    # Delegate to the main zero-emissions rule
    return _rule_zero_emissions(claim, lifecycle, meta)


def _rule_carbon_neutral(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    'Carbon neutral', 'net zero', 'CO₂ neutral', 'climate neutral'.
    FIX 5: 'commitment to carbon neutrality' is aspirational (company goal),
    not a product claim — detected upstream by _is_aspirational().
    This rule only fires for direct product-level claims.
    """
    keywords = ("carbon neutral", "net zero", "co2 neutral", "co₂ neutral",
                 "climate neutral", "carbon-neutral", "net-zero", "klimaneutral")
    if not any(k in claim.lower() for k in keywords):
        return None

    total = lifecycle["total_g_per_km"]

    if total > 5.0:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=(
                f"Lifecycle emissions are {total:.1f} g/km. A product-level 'carbon neutral' "
                "or 'net zero' claim cannot be substantiated by lifecycle data alone. "
                "EU Directive 2024/825 (EmpCo) bans product-level neutrality claims based "
                "on offsets. German BGH (Jun 2024) requires in-ad explanation of method."
            ),
            suggestion="Remove neutrality language or disclose: 'X g CO₂/km lifecycle; offset via [certified scheme].'",
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.WARNING,
        reason=(
            f"Lifecycle total is {total:.1f} g/km — very low, but regulatory guidance "
            "prohibits 'carbon neutral' product claims unless independently verified as "
            "net-zero without offsets."
        ),
        suggestion=f"Replace with: 'Near-zero lifecycle emissions: {total:.0f} g CO₂/km (independently verified LCA).'",
    )


def _rule_zero_emissions_engineering(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    FIX: 'zero-emissions engineering' — ambiguous marketing term.
    Not definitively false, but potentially misleading.
    Classified as MEDIUM / WARNING depending on lifecycle.
    Per the audit: this one specific phrase should be MEDIUM, not falsely flagged.
    """
    keywords = ("zero-emissions engineering", "zero emissions engineering",
                 "zero emission engineering")
    if not any(k in claim.lower() for k in keywords):
        return None

    total       = lifecycle["total_g_per_km"]
    operational = lifecycle["operational_g_per_km"]
    pt          = _vehicle_type_enum(meta["vehicle_type"])

    # For a true EV on a low-carbon grid, this is defensible with qualification
    if pt == VehicleType.EV and operational <= EV_OPERATIONAL_LOW_THRESHOLD:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.CAUTION,
            reason=(
                f"'Zero-emissions engineering' is ambiguous. Operational emissions "
                f"are {operational:.1f} g/km (low-carbon grid), but lifecycle total is "
                f"{total:.1f} g/km. The term could imply full lifecycle zero, which is false."
            ),
            suggestion="Clarify scope: 'Engineered for zero tailpipe emissions. Full lifecycle: {:.0f} g CO₂/km.'".format(total),
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.WARNING,
        reason=(
            f"'Zero-emissions engineering' is potentially misleading — lifecycle total is "
            f"{total:.1f} g/km and operational is {operational:.1f} g/km. "
            "UK ASA rulings on unqualified 'zero emissions' claims apply here."
        ),
        suggestion="Replace with a scoped, quantified claim referencing full lifecycle data.",
    )


def _rule_eco_friendly_green(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    Generic vague green claims.
    EU EmpCo Directive (2024/825) bans unless substantiated with recognised
    excellent environmental performance. ASA Mazda ruling (Oct 2024).
    """
    keywords = (
        "eco-friendly", "eco friendly", "environmentally friendly", "green vehicle",
        "sustainable", "clean car", "clean vehicle", "good for the planet",
        "better for the environment", "planet-friendly",
    )
    if not any(k in claim.lower() for k in keywords):
        return None

    grade = _lifecycle_intensity_grade(lifecycle["total_g_per_km"])
    total = lifecycle["total_g_per_km"]
    pt    = _vehicle_type_enum(meta["vehicle_type"])

    if pt == VehicleType.ICE or grade == "HIGH":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=(
                f"'{claim}' is a vague generic green claim for a vehicle with "
                f"{total:.1f} g/km lifecycle emissions ({grade} intensity). "
                "EU EmpCo Directive (2024/825) bans terms like 'eco-friendly', "
                "'green', 'sustainable' unless backed by outstanding independently "
                "verified environmental performance."
            ),
            suggestion="Remove entirely or replace with: 'X% lower lifecycle CO₂ than class average — verified by [standard].'",
        )

    if grade == "MEDIUM":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"'{claim}' is unsubstantiated for a {total:.1f} g/km vehicle (MEDIUM intensity). "
                "Vague green language must be backed by independently verified evidence."
            ),
            suggestion=f"Replace with: '{total:.0f} g CO₂/km full lifecycle — X% below European new-car average.'",
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.CAUTION,
        reason=(
            f"'{claim}' may be defensible at {total:.1f} g/km (LOW intensity), but "
            "EU EmpCo still requires substantiation and may be challenged on battery mining "
            "or supply-chain grounds."
        ),
        suggestion="Back with LCA summary reference and qualifier.",
    )


def _rule_self_charging(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    keywords = ("self-charging", "self charging", "self-charg")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt = _vehicle_type_enum(meta["vehicle_type"])
    if pt == VehicleType.HEV:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                "'Self-charging' implies renewable or free energy, but HEV batteries are "
                "charged solely by the petrol engine via regenerative braking. Criticised "
                "by UK ASA as misleading about the vehicle's energy source."
            ),
            suggestion="Replace with: 'Regenerative braking recovers energy from the petrol engine — no plug-in required.'",
        )

    if pt not in (VehicleType.EV, VehicleType.PHEV, VehicleType.HEV):
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=f"'Self-charging' is inapplicable to a {pt.value} vehicle.",
            suggestion="Remove the claim.",
        )
    return None


def _rule_electrified_electric_conflation(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    keywords = ("electric vehicle", " ev ", "full electric", "fully electric", "100% electric")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt = _vehicle_type_enum(meta["vehicle_type"])
    if pt in (VehicleType.HEV, VehicleType.PHEV):
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"Using 'electric' or 'EV' language for a {pt.value} risks conflating it "
                "with a battery electric vehicle. Ekō/Toyota report (Jan 2024) documented "
                "this as deliberate greenwashing that misled consumers and search engines."
            ),
            suggestion=f"Use precise terminology: '{pt.value} — a hybrid combining petrol engine with electric motor.'",
        )
    return None


def _rule_lower_emissions_comparative(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    keywords = ("lower emission", "fewer emission", "less co2", "less co₂",
                 "cleaner than", "% less", "% fewer", "% lower")
    if not any(k in claim.lower() for k in keywords):
        return None

    total = lifecycle["total_g_per_km"]
    grade = _lifecycle_intensity_grade(total)
    pt    = _vehicle_type_enum(meta["vehicle_type"])

    if pt == VehicleType.EV:
        actual_reduction = (ICE_REFERENCE_LIFECYCLE_G_PER_KM - total) / ICE_REFERENCE_LIFECYCLE_G_PER_KM
        reference_label  = "average petrol car (EU)"
    elif pt == VehicleType.PHEV:
        actual_reduction = PHEV_LIFECYCLE_REDUCTION_VS_ICE
        reference_label  = "equivalent petrol car"
    elif pt == VehicleType.HEV:
        actual_reduction = HEV_LIFECYCLE_REDUCTION_VS_ICE
        reference_label  = "equivalent petrol car"
    else:
        actual_reduction = 0.0
        reference_label  = "average new car"

    if pt == VehicleType.ICE and grade == "HIGH":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"Comparative claim for an ICE with {total:.1f} g/km lifecycle (HIGH). "
                "Without a specified baseline and independently verified figure, this "
                "risks being unsubstantiated under EU EmpCo requirements."
            ),
            suggestion="Specify comparison vehicle/class and provide a verified figure.",
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.CAUTION,
        reason=(
            f"Comparative claim broadly consistent with lifecycle data ({total:.1f} g/km; "
            f"~{actual_reduction:.0%} lower than {reference_label}). Only permissible if "
            "the comparison baseline is explicitly stated and figure is independently verified "
            "(EU EmpCo 2024/825; UK ASA 2024)."
        ),
        suggestion=f"Anchor: 'Up to {actual_reduction:.0%} lower lifecycle CO₂ vs {reference_label} — verified full LCA.'",
    )


# ---------------------------------------------------------------------------
# Rule registry
# ---------------------------------------------------------------------------

_CLAIM_RULES = [
    _rule_zero_emissions_performance,   # before zero_emissions so combined claims are caught
    _rule_zero_emissions,
    _rule_zero_emissions_engineering,
    _rule_carbon_neutral,
    _rule_eco_friendly_green,
    _rule_self_charging,
    _rule_electrified_electric_conflation,
    _rule_lower_emissions_comparative,
]


# ---------------------------------------------------------------------------
# Misleading-claims summary (for frontend Indicators card)
# ---------------------------------------------------------------------------

_MISLEADING_PRACTICES = [
    {
        "id":           "tailpipe_only",
        "practice":     "Tailpipe-only zero-emissions claim",
        "common_claim": "Zero emissions / emission-free",
        "severity":     "high",
        "reality":      "EVs still have lifecycle emissions from manufacturing and grid electricity.",
        "trigger":      lambda f: f.risk_level in (RiskLevel.WARNING, RiskLevel.VIOLATION)
                                   and "zero" in f.claim.lower()
                                   and not f.is_aspirational,
    },
    {
        "id":           "vague_green",
        "practice":     "Vague / generic green language",
        "common_claim": "Eco-friendly / sustainable / green",
        "severity":     "medium",
        "reality":      "Terms like 'eco-friendly' or 'sustainable' require verified, outstanding environmental performance under EU EmpCo Directive.",
        "trigger":      lambda f: f.risk_level in (RiskLevel.WARNING, RiskLevel.VIOLATION)
                                   and any(w in f.claim.lower()
                                           for w in ("eco", "green", "sustain", "clean", "planet")),
    },
    {
        "id":           "self_charging",
        "practice":     "Misleading 'self-charging' language",
        "common_claim": "Self-charging hybrid",
        "severity":     "medium",
        "reality":      "'Self-charging' implies renewable energy; HEV batteries are charged by the petrol engine.",
        "trigger":      lambda f: "self-charg" in f.claim.lower(),
    },
    {
        "id":           "ev_conflation",
        "practice":     "EV / electrified conflation",
        "common_claim": "Electric vehicle (applied to hybrid)",
        "severity":     "medium",
        "reality":      "Using 'electric vehicle' language for a hybrid misleads consumers about zero-emission capability.",
        "trigger":      lambda f: f.risk_level in (RiskLevel.WARNING, RiskLevel.VIOLATION)
                                   and "electric" in f.claim.lower(),
    },
    {
        "id":           "carbon_neutral",
        "practice":     "Unsubstantiated carbon neutrality claim",
        "common_claim": "Carbon neutral / net zero",
        "severity":     "high",
        "reality":      "Product-level carbon neutrality based on offsets is banned under EU EmpCo Directive 2024/825.",
        "trigger":      lambda f: f.risk_level in (RiskLevel.WARNING, RiskLevel.VIOLATION)
                                   and any(w in f.claim.lower()
                                           for w in ("carbon neutral", "net zero", "climate neutral"))
                                   and not f.is_aspirational,
    },
]


def _build_misleading_claims(findings: list[ClaimFinding]) -> list[dict]:
    """Map findings to structured misleading-practice cards for the frontend."""
    seen: set[str] = set()
    result = []
    for practice in _MISLEADING_PRACTICES:
        pid = practice["id"]
        if pid in seen:
            continue
        for f in findings:
            try:
                if practice["trigger"](f):
                    seen.add(pid)
                    result.append({
                        "practice":     practice["practice"],
                        "common_claim": practice["common_claim"],
                        "severity":     practice["severity"],
                        "reality":      practice["reality"],
                    })
                    break
            except Exception:
                pass
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_claims(
    lifecycle:        dict,
    vehicle_meta:     dict,
    proposed_claims:  Optional[list[str]] = None,
) -> GreenwashingReport:
    """
    Evaluate greenwashing risk for a vehicle given lifecycle emissions and
    any proposed marketing claims.

    FIX 1: No-rule-match → UNVERIFIED (CAUTION), not misleading.
    FIX 3: Aspirational/corporate claims → noted but not penalised.
    FIX 2: Transparency score driven by penalty model, not inverted.
    FIX 4: EV operational thresholds 50 / 100 g/km.
    FIX 5: Risk score consistent with indicators card.
    """
    required_lc = ("total_g_per_km", "operational_g_per_km", "manufacturing_g_per_km")
    for k in required_lc:
        if k not in lifecycle:
            raise KeyError(f"lifecycle dict missing key: '{k}'")

    required_vm = ("brand", "model", "vehicle_type")
    for k in required_vm:
        if k not in vehicle_meta:
            raise KeyError(f"vehicle_meta dict missing key: '{k}'")

    # Add electric key if missing
    if "electric" not in vehicle_meta:
        vehicle_meta = {**vehicle_meta, "electric": vehicle_meta["vehicle_type"] in ("EV", "PHEV")}

    # ── Structural checks ────────────────────────────────────────────────────
    structural_flags = _check_structural_consistency(lifecycle, vehicle_meta)

    # ── Per-claim checks ─────────────────────────────────────────────────────
    findings: list[ClaimFinding] = []

    for claim in (proposed_claims or []):

        # FIX 3: screen for aspirational / corporate language first
        if _is_aspirational(claim):
            findings.append(ClaimFinding(
                claim=claim,
                risk_level=RiskLevel.CAUTION,
                reason=(
                    "This is a forward-looking corporate statement, not a product claim. "
                    "It is aspirational language about company goals, not a verifiable "
                    "assertion about this vehicle's emissions."
                ),
                suggestion=(
                    "No regulatory action needed. If used alongside product marketing, "
                    "ensure it clearly refers to company strategy, not current vehicle performance."
                ),
                is_aspirational=True,
            ))
            continue

        # Screen for historical facts
        if _is_historical_fact(claim):
            findings.append(ClaimFinding(
                claim=claim,
                risk_level=RiskLevel.SAFE,
                reason="This is a factual historical statement, not an environmental claim.",
                suggestion=None,
                is_aspirational=False,
                is_unverified=False,
            ))
            continue

        # Try each rule
        matched = False
        for rule in _CLAIM_RULES:
            finding = rule(claim, lifecycle, vehicle_meta)
            if finding is not None:
                findings.append(finding)
                matched = True
                break

        if not matched:
            # FIX 1: unmatched ≠ misleading — mark as UNVERIFIED (CAUTION)
            findings.append(ClaimFinding(
                claim=claim,
                risk_level=RiskLevel.CAUTION,
                reason=(
                    "This claim was not matched by any specific greenwashing rule. "
                    "It has not been verified as accurate or misleading — manual review "
                    "is recommended to ensure it is substantiated under EU EmpCo 2024/825."
                ),
                suggestion="Verify against LCA data and applicable advertising standards.",
                is_unverified=True,
            ))

    # ── Overall risk ─────────────────────────────────────────────────────────
    # FIX 5: only genuine rule-matched findings raise overall risk.
    # Aspirational + unverified claims contribute at most CAUTION.
    risk_order = [RiskLevel.SAFE, RiskLevel.CAUTION, RiskLevel.WARNING, RiskLevel.VIOLATION]
    def _ri(r): return risk_order.index(r)

    overall = RiskLevel.SAFE
    if structural_flags:
        overall = RiskLevel.CAUTION

    for f in findings:
        if f.is_aspirational:
            # never raise risk above CAUTION for aspirational
            if _ri(RiskLevel.CAUTION) > _ri(overall):
                overall = RiskLevel.CAUTION
        else:
            if _ri(f.risk_level) > _ri(overall):
                overall = f.risk_level

    # ── Transparency score ────────────────────────────────────────────────────
    # FIX 2
    score = _compute_transparency_score(findings, structural_flags)

    # ── Misleading-claims cards ───────────────────────────────────────────────
    # FIX 5: only include genuinely matched problematic claims
    misleading = _build_misleading_claims(
        [f for f in findings if not f.is_aspirational and not f.is_unverified]
    )

    return GreenwashingReport(
        brand=vehicle_meta["brand"],
        model=vehicle_meta["model"],
        vehicle_type=vehicle_meta["vehicle_type"],
        total_g_per_km=lifecycle["total_g_per_km"],
        operational_g_per_km=lifecycle["operational_g_per_km"],
        manufacturing_g_per_km=lifecycle["manufacturing_g_per_km"],
        manufacturing_total_kg=lifecycle.get("manufacturing_total_kg", 0.0),
        recycling_kg=lifecycle.get("recycling_kg", 0.0),
        overall_risk=overall,
        transparency_score=score,
        findings=findings,
        structural_flags=structural_flags,
        misleading_claims=misleading,
    )


def batch_evaluate(
    vehicles: list[tuple[dict, dict, list[str]]],
) -> list[GreenwashingReport]:
    return [evaluate_claims(lc, meta, claims) for lc, meta, claims in vehicles]


# ---------------------------------------------------------------------------
# Quick demo — reproduces the Acura ZDX audit scenario
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    acura_lifecycle = {
        "total_g_per_km":        49.8,
        "operational_g_per_km":  10.9,
        "manufacturing_g_per_km": 34.0,
    }
    acura_meta = {
        "brand":        "Acura",
        "model":        "ZDX AWD Type S",
        "vehicle_type": "EV",
        "electric":     True,
    }
    acura_claims = [
        "transition to a zero-emissions future",       # aspirational
        "Acura's first all-electric model",            # historical fact
        "zero-emissions engineering",                  # ambiguous → CAUTION
        "commitment to achieving carbon neutrality",   # aspirational
        "offering high-performance thrills with zero emissions",  # WARNING
    ]

    report = evaluate_claims(acura_lifecycle, acura_meta, acura_claims)
    print(report.summary())
    print(f"\nTransparency score : {report.transparency_score}/100")
    print(f"Misleading claims  : {len(report.misleading_claims)}")
    print(f"Expected outcome   : MEDIUM risk, score ~75–85, 1 misleading claim")