# ==============================================================================
# PocketJury AI Service — Helpline & Crisis Detection
# ==============================================================================

from __future__ import annotations

import re
from dataclasses import dataclass, field
import structlog

logger = structlog.get_logger()


@dataclass
class HelplineEntry:
    """A single helpline record."""

    name: str
    phone: str
    description: str
    category: str


@dataclass
class HelplineResult:
    """Result of helpline/crisis detection."""

    triggered: bool = False
    categories: list[str] = field(default_factory=list)
    helplines: list[HelplineEntry] = field(default_factory=list)
    is_crisis: bool = False


# Crisis categories — any match here marks the query as a crisis
_CRISIS_CATEGORIES: frozenset[str] = frozenset({
    "suicide",
    "sexual_assault",
    "domestic_violence",
    "child_abuse",
    "cyber_crime",
})


# --- Helpline Database ---
HELPLINE_DB: dict[str, list[HelplineEntry]] = {
    "domestic_violence": [
        HelplineEntry("Women Helpline", "181", "24/7 helpline for women in distress — domestic violence, harassment, dowry, sexual assault", "Women & Child"),
        HelplineEntry("National Commission for Women", "7827-170-170", "WhatsApp for women's rights complaints", "Women & Child"),
        HelplineEntry("NALSA Legal Aid", "15100", "Free legal aid for domestic violence victims", "Legal Aid"),
    ],
    "child_abuse": [
        HelplineEntry("Childline India", "1098", "24/7 helpline for children in need of care and protection", "Women & Child"),
        HelplineEntry("Police Emergency", "112", "Unified emergency number", "Emergency"),
    ],
    "sexual_assault": [
        HelplineEntry("Women Helpline", "181", "24/7 helpline for sexual assault response", "Women & Child"),
        HelplineEntry("Police Emergency", "112", "Unified emergency number", "Emergency"),
        HelplineEntry("NALSA Legal Aid", "15100", "Free legal aid for sexual assault survivors", "Legal Aid"),
    ],
    "cyber_crime": [
        HelplineEntry("Cyber Crime Helpline", "1930", "National helpline for cyber crimes — online fraud, identity theft, cyber bullying", "Cyber Crime"),
        HelplineEntry("Police Emergency", "112", "Unified emergency number", "Emergency"),
    ],
    "consumer": [
        HelplineEntry("Consumer Helpline", "14566", "Grievances for defective products, deficient services, unfair trade", "Consumer"),
    ],
    "senior_citizen": [
        HelplineEntry("Senior Citizen Helpline", "14567", "Assistance for elder abuse, pension, medical aid, legal support", "Senior Citizens"),
        HelplineEntry("NALSA Legal Aid", "15100", "Free legal aid for senior citizens", "Legal Aid"),
    ],
    "legal_aid": [
        HelplineEntry("NALSA Legal Aid", "15100", "Free legal aid and advice for eligible citizens", "Legal Aid"),
        HelplineEntry("Department of Justice Helpline", "1800-419-8588", "Toll-free for legal aid queries and pro bono assistance", "Legal Aid"),
    ],
    "mental_health": [
        HelplineEntry("Vandrevala Foundation", "1860-2662-345", "24/7 mental health and crisis helpline", "Mental Health"),
        HelplineEntry("iCall", "9152987821", "Mental health counselling support", "Mental Health"),
    ],
    "suicide": [
        HelplineEntry("Vandrevala Foundation", "1860-2662-345", "24/7 crisis intervention helpline", "Mental Health"),
        HelplineEntry("AASRA", "9820466726", "Suicide prevention helpline", "Mental Health"),
        HelplineEntry("Police Emergency", "112", "Unified emergency number", "Emergency"),
    ],
    "ragging": [
        HelplineEntry("Anti Ragging Helpline", "1800-180-5522", "Report ragging in educational institutions", "Education"),
    ],
    "railway": [
        HelplineEntry("Railway Police (RPF)", "182", "Crimes on railway premises and trains", "Transport"),
    ],
}


class HelplineDetector:
    """
    Detects crisis situations and legal distress in user queries
    to proactively suggest relevant helpline numbers.
    """

    # Detection patterns mapped to helpline categories
    DETECTION_PATTERNS: dict[str, list[str]] = {
        "domestic_violence": [
            r"domestic\s+violence",
            r"husband\s+(beats?|hitting|abusing|threatens?)",
            r"wife\s+beating",
            r"dowry\s+(harassment|demand|torture)",
            r"in-laws?\s+(harassing|torturing|threatening|abusing)",
            r"498[aA]",
            r"protection\s+of\s+women\s+from\s+domestic\s+violence",
            r"DV\s+act",
            r"marital\s+(abuse|violence|cruelty)",
        ],
        "child_abuse": [
            r"child\s+(abuse|labour|labor|trafficking|marriage)",
            r"minor\s+(abused?|molest|exploit)",
            r"POCSO",
            r"juvenile\s+(crime|justice)",
            r"child\s+is\s+(being\s+)?(beaten|hurt|abused|exploited)",
        ],
        "sexual_assault": [
            r"rape[d]?\b",
            r"sexual\s+(assault|harassment|abuse|violence|offence)",
            r"molest(ed|ation)?",
            r"stalking",
            r"eve\s+teasing",
            r"outraging?\s+modesty",
            r"section\s+(354|375|376|63|64|74|75)\b",
        ],
        "cyber_crime": [
            r"cyber\s*(crime|fraud|bullying|stalk|threat)",
            r"online\s*(fraud|scam|harassment|threat|blackmail)",
            r"identity\s+theft",
            r"hacking",
            r"sextortion",
            r"morphed\s+(photos?|images?|videos?)",
            r"revenge\s+porn",
        ],
        "consumer": [
            r"consumer\s+(complaint|grievance|fraud)",
            r"defective\s+product",
            r"deficient\s+service",
            r"unfair\s+trade",
            r"RERA\s+complaint",
        ],
        "senior_citizen": [
            r"elder\s+(abuse|neglect)",
            r"senior\s+citizen\s+(rights?|abuse|neglect|harassment)",
            r"old\s+age\s+(home|pension|abuse)",
            r"parents?\s+(abandoned|neglected|mistreated)",
            r"maintenance\s+of\s+parents",
        ],
        "legal_aid": [
            r"free\s+legal\s+(aid|help|advice|assistance)",
            r"cannot\s+afford\s+(a\s+)?lawyer",
            r"no\s+money\s+for\s+lawyer",
            r"legal\s+services\s+authority",
            r"NALSA",
            r"DLSA",
            r"pro\s+bono",
        ],
        "mental_health": [
            r"(feeling\s+)?(depressed|hopeless|worthless|suicidal)",
            r"mental\s+health\s+(help|support|crisis)",
            r"anxiety\s+about\s+(case|court|arrest)",
            r"can'?t\s+(cope|handle|take\s+it)",
        ],
        "suicide": [
            r"(want\s+to|thinking\s+of|going\s+to)\s+(die|kill\s+myself|end\s+(my\s+)?life|suicide)",
            r"suicid(e|al)",
            r"no\s+reason\s+to\s+live",
            r"better\s+off\s+dead",
            r"end\s+it\s+all",
        ],
        "ragging": [
            r"ragging",
            r"college\s+(bullying|harassment|threat)",
            r"hostel\s+(ragging|abuse|harassment)",
        ],
    }

    def __init__(self) -> None:
        self._compiled: dict[str, list[re.Pattern]] = {}
        for category, patterns in self.DETECTION_PATTERNS.items():
            self._compiled[category] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

    def detect(self, query: str) -> HelplineResult:
        """
        Detect if query matches any crisis/helpline categories.

        Returns HelplineResult with triggered helplines.
        """
        triggered_categories: list[str] = []
        all_helplines: list[dict] = []
        seen_phones: set[str] = set()

        for category, patterns in self._compiled.items():
            for pattern in patterns:
                if pattern.search(query):
                    triggered_categories.append(category)
                    # Add helplines for this category
                    for h in HELPLINE_DB.get(category, []):
                        if h["phone"] not in seen_phones:
                            all_helplines.append(h)
                            seen_phones.add(h["phone"])
                    break  # One match per category is enough

        is_crisis = bool(set(triggered_categories) & _CRISIS_CATEGORIES)

        if triggered_categories:
            logger.info(
                "Helpline detection triggered",
                categories=triggered_categories,
                helpline_count=len(all_helplines),
                is_crisis=is_crisis,
            )

        return HelplineResult(
            triggered=bool(triggered_categories),
            categories=triggered_categories,
            helplines=all_helplines,
            is_crisis=is_crisis,
        )
