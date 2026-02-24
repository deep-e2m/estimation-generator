"""
URL extraction and normalization for estimation reference URLs.

Used to detect URLs in project description, additional instructions, document
text, and requirement docs' plain_text. Output is consumed by the URL scraping
service (Phase 2) and integrated into the project brief.

Phase 5: In production, rejects localhost and private IP hosts for safety.
"""

import re
from urllib.parse import urlparse, urlunparse

# Regex: http or https followed by :// and non-whitespace (we strip trailing punctuation after)
_URL_CANDIDATE_PATTERN = re.compile(
    r"https?://[^\s<>\"']+",
    re.IGNORECASE,
)

# Trailing characters to strip from URL candidates (common in prose)
_TRAILING_PUNCTUATION = re.compile(r"[.,;:!?)\]}\"'\s]+$")

# Reasonable max length per URL to avoid abuse
_MAX_URL_LENGTH = 2048


def _is_local_or_private_host(hostname: str | None) -> bool:
    """
    Return True if hostname is localhost or a private IP (should be rejected in production).

    Covers: localhost, ::1, 127.x.x.x, 10.x.x.x, 172.16–31.x.x, 192.168.x.x.
    """
    if not hostname or not hostname.strip():
        return False
    h = hostname.strip().lower()
    if h in ("localhost", "::1", "::"):
        return True
    if h.startswith("127."):
        return True
    if h.startswith("10."):
        return True
    if h.startswith("192.168."):
        return True
    if h.startswith("172."):
        parts = h.split(".")
        if len(parts) >= 2:
            try:
                second = int(parts[1])
                if 16 <= second <= 31:
                    return True
            except ValueError:
                pass
    return False


def extract_urls(
    *text_sources: str | None,
    allowed_schemes: tuple[str, ...] = ("https",),
    max_urls: int = 5,
    reject_local_private: bool = False,
) -> list[str]:
    """
    Extract, normalize, and deduplicate URLs from one or more text sources.

    Inputs are typically: project description, additional_instructions,
    document_summary, and requirement docs' plain_text. Combines all non-empty
    strings and finds URL candidates; normalizes and filters by scheme, then
    returns a capped list of unique URLs in order of first occurrence.

    Args:
        *text_sources: Zero or more strings (e.g. description, instructions,
            document text). None and empty strings are skipped.
        allowed_schemes: Schemes to allow (e.g. ("https",) or ("https", "http")).
            Default is https only for safety.
        max_urls: Maximum number of URLs to return (cap per request).
        reject_local_private: If True, exclude URLs whose host is localhost or
            private IP (for production safety).

    Returns:
        List of unique, normalized URLs, at most max_urls, in order of first
        appearance. Empty if no valid URLs found.
    """
    combined = " ".join(
        (s or "").strip() for s in text_sources if s is not None and (s or "").strip()
    )
    if not combined:
        return []

    seen: set[str] = set()
    result: list[str] = []

    for match in _URL_CANDIDATE_PATTERN.finditer(combined):
        if len(result) >= max_urls:
            break
        raw = match.group(0)
        # Strip trailing punctuation and whitespace
        cleaned = _TRAILING_PUNCTUATION.sub("", raw).strip()
        if len(cleaned) > _MAX_URL_LENGTH:
            continue
        normalized = _normalize_url(
            cleaned,
            allowed_schemes=allowed_schemes,
            reject_local_private=reject_local_private,
        )
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)

    return result


def _normalize_url(
    url: str,
    *,
    allowed_schemes: tuple[str, ...],
    reject_local_private: bool = False,
) -> str | None:
    """
    Normalize a URL and return it if scheme is allowed; otherwise None.

    Uses urllib.parse to parse and reconstruct, ensuring a consistent form.
    Rejects invalid URLs, schemes not in allowed_schemes, and (when
    reject_local_private is True) localhost and private IP hosts.
    """
    if not url or not url.strip():
        return None
    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    scheme = (parsed.scheme or "").lower()
    if scheme not in (s.lower() for s in allowed_schemes):
        return None
    if reject_local_private:
        hostname = (parsed.hostname or (parsed.netloc.split(":")[0] if parsed.netloc else None))
        if _is_local_or_private_host(hostname):
            return None
    # Reconstruct without fragment for deduplication (optional: keep fragment for scraping)
    normalized = urlunparse(
        (
            parsed.scheme,
            parsed.netloc or "",
            parsed.path or "/",
            parsed.params,
            parsed.query,
            "",  # drop fragment for consistency
        )
    )
    if not normalized.startswith(("http://", "https://")):
        return None
    return normalized
