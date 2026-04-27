# ==============================================================================
# PocketJury AI Service — Output Validation
# ==============================================================================

from __future__ import annotations

import re
import structlog

logger = structlog.get_logger()


class OutputValidator:
    """
    Validates LLM output for quality, accuracy signals, and compliance.

    Checks:
    1. Response length (not too short, not too long)
    2. No fabricated section numbers (basic heuristic)
    3. Disclaimer presence
    4. No promises or guarantees
    5. Hallucination signals
    """

    # Known valid IPC sections (sample — expand in production)
    KNOWN_IPC_SECTIONS = {
        "299", "300", "302", "304", "304A", "304B", "306", "307",
        "312", "323", "326", "354", "354A", "354D", "375", "376",
        "377", "378", "379", "383", "392", "395", "405", "415",
        "420", "463", "497", "498A", "499", "500", "503", "506", "509",
    }

    # Known valid BNS sections
    KNOWN_BNS_SECTIONS = {
        "63", "64", "65", "69", "74", "75", "78", "79", "80", "85",
        "88", "103", "106", "108", "109", "111", "112", "113",
        "115", "118", "152", "303", "308", "309", "310", "316",
        "318", "336", "351", "356",
    }

    # Known Acts
    KNOWN_ACTS = [
        "Indian Penal Code",
        "Bharatiya Nyaya Sanhita",
        "Code of Criminal Procedure",
        "Bharatiya Nagarik Suraksha Sanhita",
        "Indian Evidence Act",
        "Bharatiya Sakshya Adhiniyam",
        "Constitution of India",
        "Consumer Protection Act",
        "Protection of Women from Domestic Violence Act",
        "Right to Information Act",
        "Information Technology Act",
        "Hindu Marriage Act",
        "Special Marriage Act",
        "Motor Vehicles Act",
        "Negotiable Instruments Act",
        "Legal Services Authorities Act",
        "POCSO Act",
        "SC/ST Prevention of Atrocities Act",
        "Digital Personal Data Protection Act",
    ]

    def validate(self, text: str) -> list[str]:
        """
        Validate output and return a list of issue strings (empty = valid).
        """
        issues: list[str] = []

        # 1. Length check
        if len(text) < 50:
            issues.append("Response too short (< 50 chars)")
        elif len(text) > 10000:
            issues.append("Response very long (> 10K chars)")

        # 2. Check for fabricated-looking section numbers
        section_pattern = re.compile(r"Section\s+(\d+[A-Z]?)", re.IGNORECASE)
        sections_mentioned = section_pattern.findall(text)
        for s in sections_mentioned:
            if (
                s not in self.KNOWN_IPC_SECTIONS
                and s not in self.KNOWN_BNS_SECTIONS
                and not s.isdigit()  # Allow generic numbers
            ):
                # Only flag if section number looks unusual (> 600 for IPC, > 400 for BNS)
                try:
                    num = int(re.sub(r"[A-Z]", "", s))
                    if num > 600:
                        issues.append(f"Potentially fabricated section: {s}")
                except ValueError:
                    pass

        # 3. Disclaimer presence
        disclaimer_patterns = [
            r"not\s+(constitute|legal\s+advice)",
            r"consult\s+(a\s+)?(qualified\s+)?(lawyer|advocate|legal\s+professional)",
            r"educational\s+purposes?\s+only",
            r"disclaimer",
        ]
        has_disclaimer = any(
            re.search(p, text, re.IGNORECASE) for p in disclaimer_patterns
        )
        if not has_disclaimer:
            issues.append("Missing disclaimer")

        # 4. No promises/guarantees
        guarantee_patterns = [
            r"I\s+guarantee",
            r"you\s+will\s+(definitely|certainly|surely)\s+win",
            r"100%\s+(sure|certain|guaranteed)",
            r"the\s+court\s+will\s+(definitely|certainly)",
        ]
        for p in guarantee_patterns:
            if re.search(p, text, re.IGNORECASE):
                issues.append("Contains guarantee/promise")

        # 5. Hallucination signals
        hallucination_patterns = [
            r"Supreme\s+Court\s+ruled\s+in\s+\d{4}\s+that",  # Suspicious if too specific without context
            r"as\s+per\s+the\s+latest\s+amendment\s+of\s+\d{4}",
        ]
        # These are soft warnings, not blocking
        for p in hallucination_patterns:
            if re.search(p, text, re.IGNORECASE):
                issues.append("Potential hallucination signal detected (verify citations)")

        return issues
