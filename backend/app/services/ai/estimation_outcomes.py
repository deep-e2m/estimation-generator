"""
Estimation outcomes key-value contract.

Quote content can be stored as a JSON object where each key is a section
identifier and each value is the section text. This allows the editor to
render one block per key and update sections independently.
"""

# Keys for the estimation document. Order is display order.
ESTIMATION_OUTCOMES_KEYS = [
    "prepared_for",
    "project_overview",
    "website_structure",
    "development_approach",
    "estimated_effort_timeline",
    "assumptions",
    "exclusions",
]

# Human-readable labels for editor display (optional; frontend can derive from key)
ESTIMATION_OUTCOMES_LABELS = {
    "prepared_for": "Prepared for",
    "project_overview": "Project Overview",
    "website_structure": "Website Structure & Page Scope",
    "development_approach": "Development Approach",
    "estimated_effort_timeline": "Estimated Effort & Timeline",
    "assumptions": "Assumptions & Client Responsibilities",
    "exclusions": "Exclusions",
}


def is_estimation_outcomes_json(content: str) -> bool:
    """
    Return True if content looks like a serialized estimation_outcomes object
    (JSON object with string values, keys matching our section keys).
    """
    if not content or not content.strip():
        return False
    import json
    try:
        parsed = json.loads(content)
    except (TypeError, ValueError):
        return False
    if not isinstance(parsed, dict):
        return False
    # All values should be strings (section text)
    return all(isinstance(v, str) for v in parsed.values())
