"""
Stack enforcement: allowlist, canonical names, and disallowed→allowed mapping.

Ensures quotes use only tools from the resolved stack (locked + recommended)
and normalizes aliases (e.g. ACF → ACF Pro). Used by validation and
post-generation normalization.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple

from app.services.ai.static_knowledge import (
    COMPANY_STACK_STRUCTURED,
    get_company_stack_structured,
)


# ---------------------------------------------------------------------------
# Canonical name map: alias -> canonical (for detection and replacement)
# ---------------------------------------------------------------------------
CANONICAL_STACK_NAMES: Dict[str, str] = {
    "ACF": "ACF Pro",
    "Advanced Custom Fields": "ACF Pro",
    "LearnDash": "LearnDash",
    "Gravity Forms": "Gravity Forms",
    "Contact Form 7": "Contact Form 7",
    "WooCommerce": "WooCommerce",
    "Yoast SEO": "Yoast SEO",
    "Rank Math": "Rank Math",
    "WP Rocket": "WP Rocket",
    "Wordfence": "Wordfence",
    "UpdraftPlus": "UpdraftPlus",
    "Underscores (_s)": "Underscores (_s)",
    "Underscores": "Underscores (_s)",
    "_s": "Underscores (_s)",
    "Astra": "Astra",
    "GeneratePress": "GeneratePress",
    "Elementor": "Elementor",
    "Divi": "Divi",
    "Beaver Builder": "Beaver Builder",
}

# ---------------------------------------------------------------------------
# Disallowed tools -> company-approved replacement (explicit mapping)
# After adding new company plugins/themes, consider adding common alternatives
# here so post-generation normalization replaces them with the company standard.
# ---------------------------------------------------------------------------
DISALLOWED_TO_ALLOWED: Dict[str, str] = {
    "Ninja Forms": "Gravity Forms",
    "WPForms": "Gravity Forms",
    "Formidable": "Gravity Forms",
    "Divi Builder": "Divi",
    "Bricks Builder": "Elementor",
    "Breakdance": "Elementor",
    "Oxygen": "Elementor",
    "WPBakery": "Elementor",
    "Themify": "Elementor",
    "Gutenberg": "Elementor",
}


def _normalize_to_canonical(name: str) -> str:
    """Return canonical name for a given alias, or the name itself if unknown."""
    if not name or not name.strip():
        return name
    n = name.strip()
    return CANONICAL_STACK_NAMES.get(n, n)


def _extract_names_from_stack_category(
    stack: Dict[str, Any],
    category: str,
) -> Set[str]:
    """Collect all names from locked + recommended for one category (plugins/themes/page_builders)."""
    out: Set[str] = set()
    for key in ("locked", "recommended"):
        for item in (stack.get(key) or {}).get(category) or []:
            n = (item.get("name") if isinstance(item, dict) else None) or str(item).strip()
            if n:
                out.add(_normalize_to_canonical(n))
    return out


def get_allowed_stack_names(
    wordpress_stack: Dict[str, Any] | None,
) -> Dict[str, Set[str]]:
    """
    Build allowlist from resolved stack (locked + recommended).

    Returns dict with keys plugins, themes, page_builders; each value is a set
    of canonical names (for membership checks). Names are normalized to
    lowercase for case-insensitive lookup.

    Args:
        wordpress_stack: Resolved stack with "locked" and "recommended" keys.

    Returns:
        {"plugins": set of str, "themes": set of str, "page_builders": set of str}
        (canonical names, lowercase).
    """
    if not wordpress_stack:
        company = get_company_stack_structured()
        return {
            "plugins": {_normalize_to_canonical(i.get("name") or "").lower() for i in (company.get("plugins") or []) if (i.get("name") or "").strip()},
            "themes": {_normalize_to_canonical(i.get("name") or "").lower() for i in (company.get("themes") or []) if (i.get("name") or "").strip()},
            "page_builders": {_normalize_to_canonical(i.get("name") or "").lower() for i in (company.get("page_builders") or []) if (i.get("name") or "").strip()},
        }
    return {
        "plugins": {n.lower() for n in _extract_names_from_stack_category(wordpress_stack, "plugins")},
        "themes": {n.lower() for n in _extract_names_from_stack_category(wordpress_stack, "themes")},
        "page_builders": {n.lower() for n in _extract_names_from_stack_category(wordpress_stack, "page_builders")},
    }


def get_canonical_name_map() -> Dict[str, str]:
    """Return copy of alias -> canonical map (for normalization)."""
    return dict(CANONICAL_STACK_NAMES)


def get_disallowed_to_allowed_map() -> Dict[str, str]:
    """Return copy of disallowed -> allowed map (for replacement)."""
    return dict(DISALLOWED_TO_ALLOWED)


def get_default_theme_name() -> str:
    """Return the single default theme name (first in company stack). Used when no theme is locked."""
    themes = COMPANY_STACK_STRUCTURED.get("themes") or []
    if themes and isinstance(themes[0], dict):
        return themes[0].get("name") or "Underscores (_s)"
    return "Underscores (_s)"


def normalize_stack_in_text(
    text: str,
    wordpress_stack: Dict[str, Any] | None,
) -> Tuple[str, List[str]]:
    """
    Normalize plugin/theme/page builder names in quote text to match resolved stack.

    - Replaces disallowed tools with company-approved equivalents (e.g. Ninja Forms -> Gravity Forms).
    - Replaces aliases with canonical names (e.g. ACF -> ACF Pro).
    - Enforces one theme: if multiple allowed themes appear, keeps the first and rewrites the rest.

    Args:
        text: Raw content (e.g. development_approach section or full quote).
        wordpress_stack: Resolved stack (locked + recommended).

    Returns:
        (normalized_text, list of replacement descriptions for logging).
    """
    if not text or not text.strip():
        return text, []

    replacements: List[str] = []
    out = text

    allowed = get_allowed_stack_names(wordpress_stack)
    canonical_map = get_canonical_name_map()
    disallowed_map = get_disallowed_to_allowed_map()

    # Build list of names to find: disallowed first (replace with allowed), then aliases (replace with canonical).
    # Sort by length descending so we match "Advanced Custom Fields" before "ACF".
    all_candidates: List[str] = list(disallowed_map.keys()) + [k for k in canonical_map if k != canonical_map.get(k, k)]
    all_candidates = sorted(set(n for n in all_candidates if n), key=len, reverse=True)

    # 1) Replace disallowed tools with company-approved
    for disallowed in disallowed_map:
        if not disallowed:
            continue
        replacement = disallowed_map[disallowed]
        pattern = re.compile(re.escape(disallowed), re.IGNORECASE)
        if pattern.search(out):
            out = pattern.sub(replacement, out)
            replacements.append(f"{disallowed} -> {replacement} (company standard)")

    # 2) Replace aliases with canonical names (only where alias != canonical)
    for alias, canonical in canonical_map.items():
        if not alias or alias == canonical:
            continue
        pattern = re.compile(re.escape(alias), re.IGNORECASE)
        if pattern.search(out):
            out = pattern.sub(canonical, out)
            replacements.append(f"{alias} -> {canonical}")

    # 3) One-theme: if multiple allowed themes appear, keep first and replace rest
    if wordpress_stack:
        allowed_themes_canonical = _extract_names_from_stack_category(wordpress_stack, "themes")
    else:
        company = get_company_stack_structured()
        allowed_themes_canonical = {_normalize_to_canonical(i.get("name") or "") for i in (company.get("themes") or []) if (i.get("name") or "").strip()}
    if not allowed_themes_canonical:
        allowed_themes_canonical = {get_default_theme_name()}
    theme_list = sorted(allowed_themes_canonical, key=len, reverse=True)
    first_theme: str | None = None
    for theme in theme_list:
        if re.search(re.escape(theme), out, re.IGNORECASE):
            if first_theme is None:
                first_theme = theme
            else:
                out = re.sub(re.escape(theme), first_theme, out, flags=re.IGNORECASE)
                replacements.append(f"One-theme: {theme} -> {first_theme}")

    return out, replacements


def ensure_one_theme_in_text(
    text: str,
    wordpress_stack: Dict[str, Any] | None,
) -> str:
    """
    Safety net: ensure at most one theme name appears in text.
    If multiple allowed themes appear, keep the first and replace the rest.
    Call after normalize_stack_in_text to enforce one-theme in output.
    """
    if not text or not text.strip():
        return text
    if wordpress_stack:
        theme_set = _extract_names_from_stack_category(wordpress_stack, "themes")
    else:
        company = get_company_stack_structured()
        theme_set = {_normalize_to_canonical(i.get("name") or "") for i in (company.get("themes") or []) if (i.get("name") or "").strip()}
    if not theme_set:
        theme_set = {get_default_theme_name()}
    theme_list = sorted(theme_set, key=len, reverse=True)
    first_theme: str | None = None
    out = text
    for theme in theme_list:
        if re.search(re.escape(theme), out, re.IGNORECASE):
            if first_theme is None:
                first_theme = theme
            else:
                out = re.sub(re.escape(theme), first_theme, out, flags=re.IGNORECASE)
    return out
