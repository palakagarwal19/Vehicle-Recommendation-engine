"""
greenwashing.py
---------------
Greenwashing risk detection module for a vehicle lifecycle emissions platform.

Evaluates marketing claims against real lifecycle CO₂ data (g/km) and flags
misleading or unsubstantiated environmental language, consistent with:
  - EU Empowering Consumers for the Green Transition Directive (2024/825), in
    force March 2024, binding from September 2026.
  - EU Green Claims Directive (proposed; trilogue ongoing as of 2025).
  - UK ASA guidance on advertising electric and hybrid vehicles (2024).
  - Germany BGH ruling on "klimaneutral" (27 June 2024).

Usage
-----
    from greenwashing import evaluate_claims

    # lifecycle comes from calculate_lifecycle(vehicle, country, grid_year)
    lifecycle = {
        "total_g_per_km": 95.4,
        "operational_g_per_km": 0.0,
        "manufacturing_g_per_km": 95.4,
    }

    # vehicle_meta comes from the vehicle_clean database table
    vehicle_meta = {
        "brand": "Tesla",
        "model": "Model 3",
        "powertrain": "EV",   # EV | HEV | PHEV | ICE
        "electric": True,
    }

    result = evaluate_claims(lifecycle, vehicle_meta, proposed_claims=["zero emissions", "sustainable"])
    print(result)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------

# EU fleet-wide CO₂ target for new passenger cars from 2025 onward (g/km,
# tailpipe only under WLTP / Regulation EU 2019/631 as amended by 2023/851).
EU_FLEET_TARGET_G_PER_KM = 0.0  # 100 % reduction target from 2035; 0 g/km tailpipe for ZEVs

# Boundary below which a vehicle qualifies as a Zero-/Low-Emission Vehicle
# under the EU ZLEV crediting mechanism (0–50 g CO₂/km tailpipe).
ZLEV_UPPER_THRESHOLD_G_PER_KM = 50.0

# Approximate lifecycle average for a new petrol car in Europe (~2024).
# Source: Carbon Brief analysis; Transport & Environment LCA data.
ICE_REFERENCE_LIFECYCLE_G_PER_KM = 220.0

# Approximate lifecycle average for a new battery EV in Europe (~2024, average
# EU grid mix). EVs emit roughly 3× less over their full lifecycle than petrol.
EV_REFERENCE_LIFECYCLE_G_PER_KM = 75.0

# Ekō/Transport & Environment data: hybrid (HEV) lifecycle reduction vs petrol
# is ~21 %; PHEV ~26 % when fully accounting for real-world charging behaviour.
HEV_LIFECYCLE_REDUCTION_VS_ICE = 0.21
PHEV_LIFECYCLE_REDUCTION_VS_ICE = 0.26

# Thresholds used internally to grade lifecycle intensity.
# "Low"  : ≤ EV reference + 20 % margin
# "Medium": above Low, ≤ 50 % of ICE reference
# "High" : above Medium
LOW_LIFECYCLE_THRESHOLD = EV_REFERENCE_LIFECYCLE_G_PER_KM * 1.20   # ~90 g/km
MEDIUM_LIFECYCLE_THRESHOLD = ICE_REFERENCE_LIFECYCLE_G_PER_KM * 0.50  # ~110 g/km


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class RiskLevel(str, Enum):
    SAFE = "SAFE"            # Claim is well-supported by the data.
    CAUTION = "CAUTION"      # Claim is plausible but requires qualification.
    WARNING = "WARNING"      # Claim is misleading; regulatory risk is high.
    VIOLATION = "VIOLATION"  # Claim is contradicted by the data; likely illegal.


class Powertrain(str, Enum):
    EV = "EV"
    HEV = "HEV"
    PHEV = "PHEV"
    ICE = "ICE"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ClaimFinding:
    """Result of evaluating a single marketing claim."""
    claim: str
    risk_level: RiskLevel
    reason: str
    suggestion: Optional[str] = None


@dataclass
class GreenwashingReport:
    """Aggregated greenwashing evaluation for a vehicle."""
    brand: str
    model: str
    powertrain: str
    total_g_per_km: float
    operational_g_per_km: float
    manufacturing_g_per_km: float
    overall_risk: RiskLevel
    findings: list[ClaimFinding] = field(default_factory=list)
    structural_flags: list[str] = field(default_factory=list)

    def summary(self) -> str:
        lines = [
            f"=== Greenwashing Report: {self.brand} {self.model} ({self.powertrain}) ===",
            f"  Lifecycle total  : {self.total_g_per_km:.1f} g CO₂/km",
            f"  Operational      : {self.operational_g_per_km:.1f} g CO₂/km",
            f"  Manufacturing    : {self.manufacturing_g_per_km:.1f} g CO₂/km",
            f"  Overall risk     : {self.overall_risk.value}",
            "",
        ]
        if self.structural_flags:
            lines.append("Structural flags (data-level):")
            for flag in self.structural_flags:
                lines.append(f"  ⚑  {flag}")
            lines.append("")
        if self.findings:
            lines.append("Claim-level findings:")
            for f in self.findings:
                symbol = {"SAFE": "✔", "CAUTION": "⚠", "WARNING": "✘", "VIOLATION": "✖"}[f.risk_level.value]
                lines.append(f"  {symbol} [{f.risk_level.value}] '{f.claim}'")
                lines.append(f"       Reason    : {f.reason}")
                if f.suggestion:
                    lines.append(f"       Suggestion: {f.suggestion}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _lifecycle_intensity_grade(total_g: float) -> str:
    """Classify lifecycle intensity as LOW / MEDIUM / HIGH."""
    if total_g <= LOW_LIFECYCLE_THRESHOLD:
        return "LOW"
    if total_g <= MEDIUM_LIFECYCLE_THRESHOLD:
        return "MEDIUM"
    return "HIGH"


def _operational_share(lifecycle: dict) -> float:
    total = lifecycle["total_g_per_km"]
    if total <= 0:
        return 0.0
    return lifecycle["operational_g_per_km"] / total


def _manufacturing_share(lifecycle: dict) -> float:
    total = lifecycle["total_g_per_km"]
    if total <= 0:
        return 0.0
    return lifecycle["manufacturing_g_per_km"] / total


def _powertrain_enum(raw: str) -> Powertrain:
    try:
        return Powertrain(raw.upper())
    except ValueError:
        raise ValueError(
            f"Unknown powertrain '{raw}'. Must be one of: EV, HEV, PHEV, ICE."
        )


# ---------------------------------------------------------------------------
# Structural / data-level checks (independent of proposed claims)
# ---------------------------------------------------------------------------

def _check_structural_consistency(
    lifecycle: dict,
    vehicle_meta: dict,
) -> list[str]:
    """
    Return a list of data-integrity / structural greenwashing flags.

    These flags represent patterns that are problematic regardless of how the
    vehicle is marketed — e.g. an EV with surprisingly high operational
    emissions, or a PHEV claimed as near-zero lifecycle.
    """
    flags: list[str] = []
    pt = _powertrain_enum(vehicle_meta["powertrain"])
    total = lifecycle["total_g_per_km"]
    operational = lifecycle["operational_g_per_km"]
    manufacturing = lifecycle["manufacturing_g_per_km"]

    # 1. Operational emissions should be ~0 for a true BEV.
    if pt == Powertrain.EV and operational > 10.0:
        flags.append(
            f"EV with non-trivial operational emissions ({operational:.1f} g/km). "
            "Likely reflects a carbon-intensive grid. Any 'zero emissions' claim must "
            "be scoped to tailpipe only and must disclose grid dependency "
            "(UK ASA guidance 2024; EU EmpCo Directive 2024/825)."
        )

    # 2. Manufacturing dominance for EVs — battery production is the primary
    #    lifecycle hotspot; hiding this behind tailpipe-only figures is a
    #    classic selective-disclosure pattern.
    if pt == Powertrain.EV and total > 0:
        mfg_share = _manufacturing_share(lifecycle)
        if mfg_share > 0.70:
            flags.append(
                f"Manufacturing accounts for {mfg_share:.0%} of this EV's lifecycle emissions. "
                "Marketing that focuses exclusively on operational ('zero tailpipe') emissions "
                "omits the majority of the vehicle's climate impact — a selective-disclosure "
                "pattern flagged by the EU Green Claims Directive."
            )

    # 3. PHEV / HEV marketed using only electric-mode figures.
    if pt in (Powertrain.PHEV, Powertrain.HEV):
        expected_min = ICE_REFERENCE_LIFECYCLE_G_PER_KM * (
            1 - (PHEV_LIFECYCLE_REDUCTION_VS_ICE if pt == Powertrain.PHEV else HEV_LIFECYCLE_REDUCTION_VS_ICE)
        ) * 0.60  # allow 40 % headroom below research average
        if total < expected_min:
            flags.append(
                f"{pt.value} lifecycle figure ({total:.1f} g/km) is unusually low. "
                "Verify that real-world charging behaviour (not just WLTP electric range) "
                "is reflected. Toyota 'Electrified' campaign and ASA Mazda ruling (2024) "
                "both demonstrate risk of over-optimistic hybrid lifecycle figures."
            )

    # 4. ICE vehicle with lifecycle figure below a credible minimum.
    if pt == Powertrain.ICE and total < 100.0:
        flags.append(
            f"ICE vehicle with lifecycle figure of {total:.1f} g/km — below the floor "
            "for credible internal-combustion lifecycle assessments. Confirm LCA scope "
            "includes fuel upstream (WTW) and manufacturing."
        )

    # 5. Total < sum of components (data integrity).
    component_sum = operational + manufacturing
    if component_sum > total * 1.02:  # 2 % tolerance for rounding
        flags.append(
            f"Data integrity: operational ({operational:.1f}) + manufacturing "
            f"({manufacturing:.1f}) = {component_sum:.1f} g/km exceeds reported "
            f"total ({total:.1f} g/km). LCA figures may be inconsistent."
        )

    return flags


# ---------------------------------------------------------------------------
# Per-claim evaluation rules
# ---------------------------------------------------------------------------

# Each rule is a tuple of:
#   (trigger_keywords, evaluator_function)
# The evaluator receives (claim, lifecycle, vehicle_meta) and returns a
# ClaimFinding or None (if the rule does not apply).

def _rule_zero_emissions(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    'Zero emissions', 'emission-free', 'no emissions'.
    Only valid for tailpipe scope on a BEV; must not imply lifecycle zero.
    BMW / MG ASA ruling (Feb 2024): broad 'zero emission' ads were banned
    because they did not clarify that tailpipe-scope figures exclude manufacturing
    and upstream electricity.
    """
    keywords = ("zero emission", "emission-free", "no emission", "emissionless")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt = _powertrain_enum(meta["powertrain"])
    total = lifecycle["total_g_per_km"]
    operational = lifecycle["operational_g_per_km"]

    if pt != Powertrain.EV:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=(
                f"'{claim}' applied to a {pt.value} vehicle is factually incorrect. "
                f"Operational emissions: {operational:.1f} g/km; lifecycle total: "
                f"{total:.1f} g/km. The EU EmpCo Directive (2024/825) and UK ASA "
                "guidance explicitly prohibit zero-emission claims for vehicles with "
                "combustion engines."
            ),
            suggestion=(
                f"Replace with a specific, scoped statement, e.g. "
                f"'Up to X% lower lifecycle CO₂ vs an equivalent petrol car.'"
            ),
        )

    if operational > 5.0:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"This EV has operational emissions of {operational:.1f} g/km driven by "
                "grid carbon intensity. An unqualified 'zero emissions' claim is misleading "
                "(UK ASA BMW/MG ruling, Feb 2024). The claim must disclose tailpipe scope "
                "and grid dependency."
            ),
            suggestion=(
                "Qualify as 'zero tailpipe emissions' and disclose: "
                "'Actual CO₂ varies with electricity source.'"
            ),
        )

    if total > 20.0:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.CAUTION,
            reason=(
                f"Tailpipe emissions are effectively zero, but lifecycle total is "
                f"{total:.1f} g/km (manufacturing-dominated). An unqualified 'zero "
                "emissions' claim risks implying full lifecycle zero, which is false."
            ),
            suggestion=(
                "Scope the claim: 'Zero tailpipe emissions. "
                f"Full lifecycle: {total:.0f} g CO₂/km.'"
            ),
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.SAFE,
        reason=(
            f"Operational emissions are {operational:.1f} g/km and lifecycle total "
            f"{total:.1f} g/km. The claim is supportable if scoped to tailpipe "
            "and accompanied by grid-source disclosure."
        ),
        suggestion="Add tailpipe scope qualifier for full regulatory safety.",
    )


def _rule_carbon_neutral(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    'Carbon neutral', 'net zero', 'CO₂ neutral', 'climate neutral'.
    Under EU EmpCo Directive (2024/825), product-level carbon neutrality claims
    based on offsets are banned. Claims must reflect actual lifecycle impact.
    German BGH ruling (27 Jun 2024): 'klimaneutral' requires in-ad explanation.
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
                f"Lifecycle emissions are {total:.1f} g/km. A 'carbon neutral' or "
                "'net zero' claim cannot be substantiated by lifecycle data alone. "
                "Under EU Directive 2024/825 (EmpCo), product-level carbon neutrality "
                "claims based on offsets are explicitly banned. The German BGH (Jun 2024) "
                "requires any such claim to explain — within the ad — whether it reflects "
                "actual reductions or offset compensation."
            ),
            suggestion=(
                "Remove neutrality language. If offsets are used, disclose them "
                "separately: 'X g CO₂/km lifecycle; Y% offset via [certified scheme].'"
            ),
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.WARNING,
        reason=(
            f"Lifecycle total is {total:.1f} g/km — very low, but regulatory guidance "
            "across the EU and UK prohibits broad 'carbon neutral' product claims unless "
            "the entire lifecycle is independently verified to be net-zero without offsets."
        ),
        suggestion=(
            "Replace with: 'Near-zero lifecycle emissions: "
            f"{total:.0f} g CO₂/km (independently verified LCA).'"
        ),
    )


def _rule_eco_friendly_green(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    Generic vague green claims: 'eco-friendly', 'green', 'environmentally friendly',
    'sustainable', 'clean', 'good for the planet'.
    Banned under EU EmpCo Directive (2024/825) unless substantiated with
    recognised, excellent environmental performance.
    ASA ruled Mazda 'exciting, efficient and sustainable' ad misleading (Oct 2024).
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
    pt = _powertrain_enum(meta["powertrain"])

    if pt == Powertrain.ICE or grade == "HIGH":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=(
                f"'{claim}' is a vague generic green claim for a vehicle with "
                f"{total:.1f} g/km lifecycle emissions ({grade} intensity). "
                "The EU EmpCo Directive (2024/825) bans terms like 'eco-friendly', "
                "'green', and 'sustainable' unless backed by recognised outstanding "
                "environmental performance. An ICE or high-intensity vehicle cannot "
                "meet that bar."
            ),
            suggestion=(
                "Remove the claim entirely, or replace with a specific, "
                "substantiated statement: 'X% lower lifecycle CO₂ than class average, "
                "verified by [standard].'"
            ),
        )

    if grade == "MEDIUM":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"'{claim}' is unsubstantiated for a vehicle with {total:.1f} g/km "
                "lifecycle emissions (MEDIUM intensity). Under EU and UK rules, vague "
                "green language must be backed by independently verified evidence of "
                "outstanding performance."
            ),
            suggestion=(
                f"Replace with a specific comparative: '{total:.0f} g CO₂/km "
                "full lifecycle — X% below the European new-car average.'"
            ),
        )

    # LOW intensity — still CAUTION because "sustainable" may mislead on
    # manufacturing / battery mining dimensions.
    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.CAUTION,
        reason=(
            f"'{claim}' may be defensible given low lifecycle intensity "
            f"({total:.1f} g/km), but the EU EmpCo Directive still requires "
            "substantiation. The claim may be challenged on battery mining, "
            "end-of-life recycling, or supply-chain grounds."
        ),
        suggestion=(
            "Back the claim with an LCA summary reference and a qualifier "
            "such as 'lower lifecycle CO₂ than average — see full LCA at [URL].'"
        ),
    )


def _rule_self_charging(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    'Self-charging' applied to HEVs.
    UK ASA and consumer advocates have consistently ruled this misleading: the
    energy ultimately comes from burning petrol. Toyota was explicitly targeted by
    Ekō (Jan 2024) for conflating 'electrified' and 'electric'.
    """
    keywords = ("self-charging", "self charging", "self-charg")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt = _powertrain_enum(meta["powertrain"])

    if pt == Powertrain.HEV:
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                "'Self-charging' implies renewable or free energy, but HEV batteries "
                "are charged solely by the petrol engine via regenerative braking. "
                "This framing has been criticised by the UK ASA and consumer watchdogs "
                "as misleading consumers about the vehicle's energy source and "
                "environmental impact."
            ),
            suggestion=(
                "Replace with an accurate description: 'Regenerative braking "
                "recovers energy from the petrol engine — no plug-in required.'"
            ),
        )

    if pt not in (Powertrain.EV, Powertrain.PHEV, Powertrain.HEV):
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.VIOLATION,
            reason=f"'Self-charging' is inapplicable to a {pt.value} powertrain.",
            suggestion="Remove the claim.",
        )

    return None


def _rule_electrified_electric_conflation(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    Using 'electric' or 'electric vehicle' language for non-BEV powertrains.
    Toyota Ekō report (Jan 2024) documented systematic conflation of 'electrified'
    and 'electric' to divert consumers searching for EVs toward hybrids.
    """
    keywords = ("electric vehicle", " ev ", "full electric", "fully electric", "100% electric")
    if not any(k in claim.lower() for k in keywords):
        return None

    pt = _powertrain_enum(meta["powertrain"])

    if pt in (Powertrain.HEV, Powertrain.PHEV):
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"Using 'electric' or 'EV' language for a {pt.value} powertrain risks "
                "conflating it with a battery electric vehicle. The Ekō/Toyota report "
                "(Jan 2024) documented this practice as deliberate greenwashing that "
                "misled both consumers and search engines. HEV lifecycle emissions are "
                f"~{ICE_REFERENCE_LIFECYCLE_G_PER_KM * (1 - HEV_LIFECYCLE_REDUCTION_VS_ICE):.0f} g/km "
                "vs ~75 g/km for a BEV in Europe."
            ),
            suggestion=(
                f"Use precise powertrain terminology: '{pt.value} — a hybrid that "
                "combines a petrol engine with an electric motor.'"
            ),
        )

    return None


def _rule_lower_emissions_comparative(claim: str, lifecycle: dict, meta: dict) -> Optional[ClaimFinding]:
    """
    Comparative claims: 'lower emissions', 'fewer emissions', 'cleaner than',
    'X% less CO₂'. These are allowable only if the comparison baseline is
    specified and the figure is accurate.
    """
    keywords = ("lower emission", "fewer emission", "less co2", "less co₂",
                 "cleaner than", "% less", "% fewer", "% lower")
    if not any(k in claim.lower() for k in keywords):
        return None

    total = lifecycle["total_g_per_km"]
    grade = _lifecycle_intensity_grade(total)
    pt = _powertrain_enum(meta["powertrain"])

    # Estimate plausible reduction vs ICE reference for each powertrain.
    if pt == Powertrain.EV:
        actual_reduction = (ICE_REFERENCE_LIFECYCLE_G_PER_KM - total) / ICE_REFERENCE_LIFECYCLE_G_PER_KM
        reference_label = "average petrol car (EU)"
    elif pt == Powertrain.PHEV:
        actual_reduction = PHEV_LIFECYCLE_REDUCTION_VS_ICE
        reference_label = "equivalent petrol car"
    elif pt == Powertrain.HEV:
        actual_reduction = HEV_LIFECYCLE_REDUCTION_VS_ICE
        reference_label = "equivalent petrol car"
    else:
        actual_reduction = 0.0
        reference_label = "average new car"

    if pt == Powertrain.ICE and grade == "HIGH":
        return ClaimFinding(
            claim=claim,
            risk_level=RiskLevel.WARNING,
            reason=(
                f"Comparative emissions claim for an ICE vehicle with "
                f"{total:.1f} g/km lifecycle intensity (HIGH). Without a specified "
                "baseline and independently verified figure, this claim risks being "
                "unsubstantiated under EU EmpCo Directive requirements."
            ),
            suggestion=(
                "Specify the comparison vehicle/class and provide a verified figure: "
                "'X g CO₂/km lifecycle vs Y g/km for [class average] — "
                "verified by [standard/body].'"
            ),
        )

    return ClaimFinding(
        claim=claim,
        risk_level=RiskLevel.CAUTION,
        reason=(
            f"Comparative claim appears broadly consistent with lifecycle data "
            f"({total:.1f} g/km; ~{actual_reduction:.0%} lower than {reference_label}). "
            "However, the claim is only permissible if the comparison baseline is "
            "explicitly stated and the figure is independently verified "
            "(EU EmpCo Directive 2024/825; UK ASA guidance 2024)."
        ),
        suggestion=(
            f"Anchor the claim: 'Up to {actual_reduction:.0%} lower lifecycle CO₂ "
            f"vs {reference_label} — verified full lifecycle assessment.'"
        ),
    )


# ---------------------------------------------------------------------------
# Rule registry
# ---------------------------------------------------------------------------

_CLAIM_RULES = [
    _rule_zero_emissions,
    _rule_carbon_neutral,
    _rule_eco_friendly_green,
    _rule_self_charging,
    _rule_electrified_electric_conflation,
    _rule_lower_emissions_comparative,
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_claims(
    lifecycle: dict,
    vehicle_meta: dict,
    proposed_claims: Optional[list[str]] = None,
) -> GreenwashingReport:
    """
    Evaluate greenwashing risk for a vehicle given its lifecycle emissions data
    and any proposed marketing claims.

    Parameters
    ----------
    lifecycle : dict
        Output of calculate_lifecycle(vehicle, country, grid_year).
        Required keys: total_g_per_km, operational_g_per_km, manufacturing_g_per_km.
    vehicle_meta : dict
        Row from the vehicle_clean database table.
        Required keys: brand, model, powertrain (EV|HEV|PHEV|ICE), electric (bool).
    proposed_claims : list[str], optional
        Marketing copy phrases to evaluate.  If None, only structural flags are
        generated.

    Returns
    -------
    GreenwashingReport
        Structured report with per-claim findings, structural flags, and an
        overall risk level.
    """
    # Validate inputs.
    required_lifecycle_keys = ("total_g_per_km", "operational_g_per_km", "manufacturing_g_per_km")
    for k in required_lifecycle_keys:
        if k not in lifecycle:
            raise KeyError(f"lifecycle dict is missing required key: '{k}'")

    required_meta_keys = ("brand", "model", "powertrain", "electric")
    for k in required_meta_keys:
        if k not in vehicle_meta:
            raise KeyError(f"vehicle_meta dict is missing required key: '{k}'")

    # Structural checks.
    structural_flags = _check_structural_consistency(lifecycle, vehicle_meta)

    # Per-claim checks.
    findings: list[ClaimFinding] = []
    for claim in (proposed_claims or []):
        matched = False
        for rule in _CLAIM_RULES:
            finding = rule(claim, lifecycle, vehicle_meta)
            if finding is not None:
                findings.append(finding)
                matched = True
                break  # first matching rule wins per claim
        if not matched:
            # Unrecognised claim — flag for manual review.
            findings.append(
                ClaimFinding(
                    claim=claim,
                    risk_level=RiskLevel.CAUTION,
                    reason=(
                        "This claim was not matched by any specific rule. "
                        "Manual review is recommended to ensure it is substantiated "
                        "and scoped correctly under EU EmpCo Directive 2024/825."
                    ),
                    suggestion="Verify claim against LCA data and applicable advertising standards.",
                )
            )

    # Overall risk = worst finding or CAUTION if there are structural flags.
    risk_order = [RiskLevel.SAFE, RiskLevel.CAUTION, RiskLevel.WARNING, RiskLevel.VIOLATION]

    def _risk_index(r: RiskLevel) -> int:
        return risk_order.index(r)

    overall = RiskLevel.SAFE
    if structural_flags:
        overall = RiskLevel.CAUTION
    for f in findings:
        if _risk_index(f.risk_level) > _risk_index(overall):
            overall = f.risk_level

    return GreenwashingReport(
        brand=vehicle_meta["brand"],
        model=vehicle_meta["model"],
        powertrain=vehicle_meta["powertrain"],
        total_g_per_km=lifecycle["total_g_per_km"],
        operational_g_per_km=lifecycle["operational_g_per_km"],
        manufacturing_g_per_km=lifecycle["manufacturing_g_per_km"],
        overall_risk=overall,
        findings=findings,
        structural_flags=structural_flags,
    )


def batch_evaluate(
    vehicles: list[tuple[dict, dict, list[str]]],
) -> list[GreenwashingReport]:
    """
    Evaluate multiple vehicles in a single call.

    Parameters
    ----------
    vehicles : list of (lifecycle, vehicle_meta, proposed_claims) tuples.

    Returns
    -------
    list of GreenwashingReport, one per input tuple.
    """
    return [evaluate_claims(lc, meta, claims) for lc, meta, claims in vehicles]


# ---------------------------------------------------------------------------
# Quick demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    examples = [
        # BEV on a coal-heavy grid, claiming "zero emissions"
        (
            {"total_g_per_km": 130.0, "operational_g_per_km": 55.0, "manufacturing_g_per_km": 75.0},
            {"brand": "AnyEV", "model": "City 300", "powertrain": "EV", "electric": True},
            ["zero emissions", "eco-friendly", "sustainable"],
        ),
        # HEV marketed as "self-charging electric vehicle"
        (
            {"total_g_per_km": 175.0, "operational_g_per_km": 145.0, "manufacturing_g_per_km": 30.0},
            {"brand": "HybridCo", "model": "Synergy X", "powertrain": "HEV", "electric": False},
            ["self-charging", "electric vehicle", "lower emissions than petrol"],
        ),
        # Well-performing BEV on clean grid
        (
            {"total_g_per_km": 68.0, "operational_g_per_km": 0.0, "manufacturing_g_per_km": 68.0},
            {"brand": "CleanDrive", "model": "Aurora", "powertrain": "EV", "electric": True},
            ["zero tailpipe emissions", "up to 70% lower lifecycle CO₂ vs petrol"],
        ),
        # ICE vehicle claiming "carbon neutral"
        (
            {"total_g_per_km": 215.0, "operational_g_per_km": 175.0, "manufacturing_g_per_km": 40.0},
            {"brand": "PetrolMax", "model": "Turbo 2000", "powertrain": "ICE", "electric": False},
            ["carbon neutral", "eco-friendly", "green car"],
        ),
    ]

    for lc, meta, claims in examples:
        report = evaluate_claims(lc, meta, claims)
        print(report.summary())
        print()
