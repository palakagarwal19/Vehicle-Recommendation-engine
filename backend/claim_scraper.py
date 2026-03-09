"""
claim_scraper.py
----------------
Web search layer for the vehicle lifecycle emissions greenwashing platform.

Searches the web for real marketing claims made by manufacturers about a
specific vehicle, extracts environmental/emissions language, and returns a
deduplicated list of claim strings ready to pass into greenwashing.evaluate_claims().

Architecture
------------
    vehicle_meta (brand, model, powertrain)
          │
          ▼
    ClaimScraper.fetch(vehicle_meta)
          │
          ├── build_queries()         → search query strings
          ├── search_web()            → raw search results (via pluggable backend)
          ├── extract_claims()        → pull environmental phrases from snippets
          └── deduplicate_claims()    → normalise + remove near-duplicates
          │
          ▼
    List[ScrapedClaim]  →  greenwashing.evaluate_claims()

Search backends
---------------
The scraper uses a thin SearchBackend protocol so you can swap providers:
  - DuckDuckGoBackend   : free, no API key, rate-limited (~1 req/s)
  - SerpApiBackend      : paid, reliable, structured JSON
  - BraveBackend        : paid, privacy-first, good for EU data
  - OllamaBackend       : local Phi-3 (or any Ollama model) to *generate*
                          plausible claims from its training data when no live
                          search is available (offline / air-gapped deployments)

Install dependencies
--------------------
    pip install requests duckduckgo-search          # for DuckDuckGoBackend
    pip install google-search-results               # for SerpApiBackend
    pip install requests                            # for BraveBackend
    # Ollama: run `ollama pull phi3` and start the server

Usage
-----
    from claim_scraper import ClaimScraper, DuckDuckGoBackend
    from greenwashing import evaluate_claims

    lifecycle = {
        "total_g_per_km": 95.4,
        "operational_g_per_km": 0.0,
        "manufacturing_g_per_km": 95.4,
    }
    vehicle_meta = {
        "brand": "Tesla",
        "model": "Model 3",
        "powertrain": "EV",
        "electric": True,
    }

    scraper = ClaimScraper(backend=DuckDuckGoBackend())
    scraped = scraper.fetch(vehicle_meta)

    claim_strings = [c.text for c in scraped]
    report = evaluate_claims(lifecycle, vehicle_meta, proposed_claims=claim_strings)
    print(report.summary())
"""

from __future__ import annotations

import re
import time
import logging
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Environmental claim vocabulary
# ---------------------------------------------------------------------------

# Phrases that indicate environmental marketing language worth extracting.
# Grouped by theme so new terms are easy to add.
CLAIM_VOCABULARY: dict[str, list[str]] = {
    "zero_emissions": [
        "zero emission", "zero-emission", "emission-free", "no emission",
        "zero exhaust", "zero co2", "zero co₂", "zero carbon",
    ],
    "carbon_neutrality": [
        "carbon neutral", "carbon-neutral", "net zero", "net-zero",
        "co2 neutral", "co₂ neutral", "climate neutral", "climate-neutral",
        "carbon free", "carbon-free",
    ],
    "vague_green": [
        "eco-friendly", "eco friendly", "environmentally friendly",
        "sustainable", "green car", "green vehicle", "clean car", "clean vehicle",
        "planet-friendly", "good for the planet", "better for the environment",
        "responsible", "cleaner future", "cleaner driving",
    ],
    "hybrid_misleading": [
        "self-charging", "self charging", "electric vehicle", "full electric",
        "fully electric", "100% electric", "electrified",
    ],
    "comparative": [
        "lower emission", "fewer emission", "less co2", "less co₂",
        "cleaner than", "% less", "% fewer", "% lower", "% reduction",
        "compared to petrol", "compared to diesel", "vs petrol", "vs diesel",
        "times cleaner", "times less",
    ],
    "impact": [
        "avoid", "avoided emissions", "saves the planet", "saves co2",
        "reduces pollution", "reduces emissions", "helps the environment",
    ],
}

# Flatten for fast membership testing.
_ALL_CLAIM_TERMS: set[str] = {
    term for terms in CLAIM_VOCABULARY.values() for term in terms
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ScrapedClaim:
    """A single environmental marketing claim found in the wild."""
    text: str                        # Normalised claim phrase
    source_url: str                  # Where it was found
    source_snippet: str              # Raw sentence/context it was extracted from
    category: str                    # Vocabulary category (zero_emissions, etc.)
    confidence: float = 1.0         # 0–1; lower for fuzzy/generated claims


# ---------------------------------------------------------------------------
# Search backend protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class SearchBackend(Protocol):
    """
    Pluggable search provider.
    Implementors must return a list of dicts:
        [{"url": str, "snippet": str}, ...]
    """
    def search(self, query: str, max_results: int = 10) -> list[dict]:
        ...


# ---------------------------------------------------------------------------
# Backend implementations
# ---------------------------------------------------------------------------

class DuckDuckGoBackend:
    """
    Free, no-API-key DuckDuckGo search via the duckduckgo-search package.
    Install: pip install duckduckgo-search
    Rate limit: ~1 request per second; ClaimScraper adds automatic delays.
    """
    def __init__(self, region: str = "wt-wt", safesearch: str = "off"):
        self.region = region
        self.safesearch = safesearch

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        try:
            from ddgs import DDGS
        except ImportError:
            raise ImportError(
                "Install duckduckgo-search: pip install duckduckgo-search"
            )
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(
                query,
                region=self.region,
                safesearch=self.safesearch,
                max_results=max_results,
            ):
                results.append({
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
        return results


class SerpApiBackend:
    """
    Paid SerpApi (serpapi.com) backend — reliable, structured, no rate-limit issues.
    Install: pip install google-search-results
    """
    def __init__(self, api_key: str, engine: str = "google"):
        self.api_key = api_key
        self.engine = engine

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        try:
            from serpapi import GoogleSearch
        except ImportError:
            raise ImportError(
                "Install SerpApi client: pip install google-search-results"
            )
        params = {
            "q": query,
            "api_key": self.api_key,
            "engine": self.engine,
            "num": max_results,
        }
        raw = GoogleSearch(params).get_dict()
        results = []
        for r in raw.get("organic_results", [])[:max_results]:
            results.append({
                "url": r.get("link", ""),
                "snippet": r.get("snippet", ""),
            })
        return results


class BraveBackend:
    """
    Brave Search API backend — privacy-first, good EU data coverage.
    Get a free API key at https://api.search.brave.com
    Install: pip install requests
    """
    BASE_URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        try:
            import requests
        except ImportError:
            raise ImportError("Install requests: pip install requests")

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
        }
        params = {"q": query, "count": min(max_results, 20)}
        resp = requests.get(self.BASE_URL, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        results = []
        for r in resp.json().get("web", {}).get("results", [])[:max_results]:
            results.append({
                "url": r.get("url", ""),
                "snippet": r.get("description", ""),
            })
        return results


class OllamaBackend:
    """
    Local Phi-3 (or any Ollama model) backend for offline/air-gapped deployments.

    Instead of live web search, this backend prompts the local LLM to generate
    plausible environmental marketing claims for the given brand/model based on
    its training knowledge. Confidence is set lower (0.6) to signal these are
    inferred, not scraped.

    Prerequisites:
        ollama pull phi3        (or phi3:mini, phi3:medium, mistral, etc.)
        ollama serve            (starts on localhost:11434 by default)
    Install: pip install requests  (uses Ollama's REST API directly)
    """
    OLLAMA_URL = "http://localhost:11434/api/generate"

    def __init__(self, model: str = "phi3", host: str = "http://localhost:11434"):
        self.model = model
        self.host = host
        self.url = f"{host}/api/generate"

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        """
        'Search' by asking the local LLM what marketing claims a brand/model
        typically makes. Returns synthetic snippets with confidence=0.6.
        """
        try:
            import requests
            import json as _json
        except ImportError:
            raise ImportError("Install requests: pip install requests")

        prompt = (
            f"You are a database of automotive marketing copy.\n"
            f"List up to {max_results} real or representative environmental marketing "
            f"claims that have been used to advertise the vehicle described in this "
            f"search query: '{query}'.\n"
            f"Focus on green/eco/emissions language.\n"
            f"Return ONLY a JSON array of plain strings, e.g.:\n"
            f'["zero tailpipe emissions", "up to 70% lower CO2 than petrol", ...]\n'
            f"No preamble, no explanation, only the JSON array."
        )

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 512},
        }

        try:
            resp = requests.post(self.url, json=payload, timeout=60)
            resp.raise_for_status()
            raw_text = resp.json().get("response", "[]")
            # Strip markdown fences if present.
            raw_text = re.sub(r"```(?:json)?|```", "", raw_text).strip()
            claims_list = _json.loads(raw_text)
            if not isinstance(claims_list, list):
                return []
            return [
                {
                    "url": f"ollama://{self.model}",
                    "snippet": claim,
                    "_confidence": 0.6,
                }
                for claim in claims_list[:max_results]
                if isinstance(claim, str)
            ]
        except Exception as exc:
            logger.warning("OllamaBackend error: %s", exc)
            return []


# ---------------------------------------------------------------------------
# Core scraper
# ---------------------------------------------------------------------------

class ClaimScraper:
    """
    Searches the web (or local LLM) for environmental marketing claims
    made about a specific vehicle.

    Parameters
    ----------
    backend : SearchBackend
        The search provider to use (DuckDuckGoBackend, SerpApiBackend, etc.)
    max_results_per_query : int
        How many search results to fetch per query string.
    request_delay_s : float
        Seconds to wait between search requests (important for DuckDuckGo).
    min_confidence : float
        Drop claims below this confidence threshold before returning.
    """

    # Query templates — {brand}, {model}, {powertrain} are interpolated.
    QUERY_TEMPLATES = [
        "{brand} {model} emissions environmental claims",
        "{brand} {model} marketing eco sustainable green",
        "{brand} {model} zero emission carbon neutral advertisement",
        'site:{brand_domain} "{model}" sustainable OR "zero emission" OR "eco"',
        "{brand} {model} {powertrain} environmental advertising 2024",
    ]

    # Common manufacturer domain patterns for site: queries.
    BRAND_DOMAINS: dict[str, str] = {
        "tesla": "tesla.com",
        "bmw": "bmw.com",
        "toyota": "toyota.com",
        "volkswagen": "vw.com",
        "mercedes": "mercedes-benz.com",
        "ford": "ford.com",
        "hyundai": "hyundai.com",
        "kia": "kia.com",
        "nissan": "nissan.com",
        "renault": "renault.com",
        "peugeot": "peugeot.com",
        "stellantis": "stellantis.com",
        "audi": "audi.com",
        "volvo": "volvocars.com",
        "mazda": "mazda.com",
        "honda": "honda.com",
        "subaru": "subaru.com",
    }

    def __init__(
        self,
        backend: SearchBackend,
        max_results_per_query: int = 8,
        request_delay_s: float = 1.2,
        min_confidence: float = 0.5,
    ):
        self.backend = backend
        self.max_results_per_query = max_results_per_query
        self.request_delay_s = request_delay_s
        self.min_confidence = min_confidence

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch(self, vehicle_meta: dict) -> list[ScrapedClaim]:
        """
        Main entry point. Runs all queries and returns deduplicated claims.

        Parameters
        ----------
        vehicle_meta : dict
            Same dict as used in greenwashing.evaluate_claims().
            Required keys: brand, model, powertrain.

        Returns
        -------
        list[ScrapedClaim]
        """
        brand = vehicle_meta["brand"]
        model = vehicle_meta["model"]
        powertrain = vehicle_meta["powertrain"]

        queries = self._build_queries(brand, model, powertrain)
        raw_results: list[dict] = []

        for i, query in enumerate(queries):
            logger.info("Searching [%d/%d]: %s", i + 1, len(queries), query)
            try:
                results = self.backend.search(query, max_results=self.max_results_per_query)
                raw_results.extend(results)
            except Exception as exc:
                logger.warning("Search failed for query '%s': %s", query, exc)
            if i < len(queries) - 1:
                time.sleep(self.request_delay_s)

        claims = self._extract_claims(raw_results)
        claims = self._deduplicate(claims)
        claims = [c for c in claims if c.confidence >= self.min_confidence]

        logger.info(
            "Found %d unique claims for %s %s", len(claims), brand, model
        )
        return claims

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_queries(self, brand: str, model: str, powertrain: str) -> list[str]:
        brand_domain = self.BRAND_DOMAINS.get(brand.lower(), f"{brand.lower()}.com")
        queries = []
        for template in self.QUERY_TEMPLATES:
            q = template.format(
                brand=brand,
                model=model,
                powertrain=powertrain,
                brand_domain=brand_domain,
            )
            queries.append(q)
        return queries

    def _extract_claims(self, raw_results: list[dict]) -> list[ScrapedClaim]:
        """
        Scan each snippet for environmental claim vocabulary and extract the
        surrounding sentence as the claim context.
        """
        found: list[ScrapedClaim] = []
        for result in raw_results:
            url = result.get("url", "")
            snippet = result.get("snippet", "")
            confidence = float(result.get("_confidence", 1.0))

            if not snippet:
                continue

            sentences = self._split_sentences(snippet)
            for sentence in sentences:
                sentence_lower = sentence.lower()
                for category, terms in CLAIM_VOCABULARY.items():
                    for term in terms:
                        if term in sentence_lower:
                            # Extract the matched term as the normalised claim.
                            claim_text = self._extract_claim_phrase(sentence, term)
                            if claim_text:
                                found.append(
                                    ScrapedClaim(
                                        text=claim_text,
                                        source_url=url,
                                        source_snippet=sentence.strip(),
                                        category=category,
                                        confidence=confidence,
                                    )
                                )
                            break  # one match per sentence per category

        return found

    def _extract_claim_phrase(self, sentence: str, matched_term: str) -> str:
        """
        Return a short, normalised claim phrase centred on the matched term.
        Tries to capture the full meaningful clause (up to ~12 words) around it.
        """
        s = sentence.strip()
        idx = s.lower().find(matched_term)
        if idx == -1:
            return matched_term

        # Take up to 6 words before and 6 words after the match.
        before = s[:idx].split()[-6:]
        term_words = matched_term.split()
        after = s[idx + len(matched_term):].split()[:6]
        phrase = " ".join(before + term_words + after).strip()

        # Clean punctuation artifacts at boundaries.
        phrase = re.sub(r'^[^a-zA-Z0-9"\'(]+', "", phrase)
        phrase = re.sub(r'[^a-zA-Z0-9"\'%)]+$', "", phrase)
        return phrase if len(phrase) > 3 else matched_term

    def _split_sentences(self, text: str) -> list[str]:
        """Naive sentence splitter — good enough for ad/search snippets."""
        # Split on .!? followed by whitespace or end of string.
        sentences = re.split(r'(?<=[.!?])\s+', text)
        # Also split on em-dashes and bullet characters common in ad copy.
        result = []
        for s in sentences:
            result.extend(re.split(r'\s*[–—•·]\s*', s))
        return [s.strip() for s in result if len(s.strip()) > 10]

    def _deduplicate(self, claims: list[ScrapedClaim]) -> list[ScrapedClaim]:
        """
        Remove near-duplicate claims using normalised text comparison.
        Keeps the highest-confidence version of each near-duplicate group.
        """
        seen: dict[str, ScrapedClaim] = {}
        for claim in sorted(claims, key=lambda c: -c.confidence):
            key = self._normalise_key(claim.text)
            if key not in seen:
                seen[key] = claim
        return list(seen.values())

    @staticmethod
    def _normalise_key(text: str) -> str:
        """Lower-case, strip punctuation and common filler words for dedup."""
        t = text.lower()
        t = re.sub(r"[^\w\s]", " ", t)
        # Remove very common filler words that don't change meaning.
        filler = {"the", "a", "an", "its", "our", "your", "this", "that",
                  "and", "or", "with", "for", "of", "in", "on", "at", "to"}
        words = [w for w in t.split() if w not in filler]
        return " ".join(words[:8])  # key on first 8 meaningful words


# ---------------------------------------------------------------------------
# Convenience: full pipeline in one call
# ---------------------------------------------------------------------------

def scrape_and_evaluate(
    lifecycle: dict,
    vehicle_meta: dict,
    backend: SearchBackend,
    max_results_per_query: int = 8,
    request_delay_s: float = 1.2,
):
    """
    Full pipeline: search → extract → evaluate.

    Returns (GreenwashingReport, list[ScrapedClaim])
    """
    from greenwashing import evaluate_claims

    scraper = ClaimScraper(
        backend=backend,
        max_results_per_query=max_results_per_query,
        request_delay_s=request_delay_s,
    )
    scraped = scraper.fetch(vehicle_meta)
    claim_strings = [c.text for c in scraped]
    report = evaluate_claims(lifecycle, vehicle_meta, proposed_claims=claim_strings)
    return report, scraped


# ---------------------------------------------------------------------------
# CLI demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    import json

    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    # Demo: use OllamaBackend (works offline) or swap to DuckDuckGoBackend().
    # To use live search: backend = DuckDuckGoBackend()
    # To use Phi-3 locally: backend = OllamaBackend(model="phi3")

    print("claim_scraper.py — demo mode")
    print("Backend options: DuckDuckGoBackend | SerpApiBackend | BraveBackend | OllamaBackend")
    print()

    # Show vocabulary summary instead of running live search in demo.
    print("Monitored claim vocabulary:")
    for category, terms in CLAIM_VOCABULARY.items():
        print(f"  [{category}]  {', '.join(terms[:4])}{'...' if len(terms) > 4 else ''}")

    print()
    print("Example usage:")
    print("""
    from claim_scraper import ClaimScraper, DuckDuckGoBackend, OllamaBackend
    from greenwashing import evaluate_claims

    lifecycle = {
        "total_g_per_km": 95.4,
        "operational_g_per_km": 0.0,
        "manufacturing_g_per_km": 95.4,
    }
    vehicle_meta = {
        "brand": "Tesla", "model": "Model 3",
        "powertrain": "EV", "electric": True,
    }

    # Live web search:
    backend = DuckDuckGoBackend()

    # OR local Phi-3 (no internet needed):
    # backend = OllamaBackend(model="phi3")

    scraper = ClaimScraper(backend=backend)
    scraped = scraper.fetch(vehicle_meta)

    report, scraped = scrape_and_evaluate(lifecycle, vehicle_meta, backend)
    print(report.summary())
    for c in scraped:
        print(f"  [{c.category}] {c.text!r}  ({c.source_url})")
    """)
