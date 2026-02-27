"""
Avatar placeholder service.

Uses OpenRouter (low-cost model) to classify first name as male/female for
placeholder avatar selection. Results are cached per first name to minimize API calls.
"""

import logging
from typing import Literal

from app.services.ai.openrouter_client import (
    OpenRouterClient,
    OpenRouterError,
)

logger = logging.getLogger(__name__)

# Placeholder image URLs (must match frontend for consistency)
MALE_PLACEHOLDER_URLS = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD_GhPGKod3E8opSViWsrBRgIbHxhTuojVJnNxijYvQ1XDuqWZuL9Wd28G0eIzHPj1xCEb0Me7f6jUir8GowK7c83rjzuGgPu9zQAcQ_mvxgRVrrMeQ5wTIbR0iUUEllBU3dK-hK3q3BKVTkyWUJPFn8OFxdu3HA3LK6ipl1U2qKcLYMseQt8_9mg-v9xtmPBwIfTnRwenMHo3Vr6QHcNkzrYswhliynu9b3a8HjikE_p-G-KWh_MaOEHKVEoW9wuPzd64pXIYw5Hs",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDmBGBMNeY1XSEM6MPQBun_8LVJ55Niu3T2JN0dy5N5B9Ully3-LCvymbIeHxHqctquHuEQ8OozQT0gTk0dvWvTiou2RdImK8Flm1dSnISE4pocNh0VHGZ8CTum2YW7LBlv05tNUvcafnXaMglpqAWpE7m3CSem1iq-Ng-yqiVDmNp3h5lmfzEJ_3788SPPWRY1e_I9fX_hD88vvr4Spo0cSQu_GaPpiY9_a5MEG7_fm2MaRGW3pOFGQCwGrbcUQ6QYn1I4Uz4JgCI",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBpq0AnPQ7R8HCvOy6ODFZ_YL5MvE1n-oMNKnbJsUPR0NxdJPlriFVQetYpaTgBILU1Hkc-1RjGNYqjiLTCUej9_OWU8z0-gtVuLJnNeeh6tzryL-e7_ZuYzLXe-mzW6MxDYmUP64W3kFWdmuvfGkZ0PGdHMlxgSj5DGl8IeE16S_k_YI8KDnFH11-hvSLMYd8kIQNVgP7NB0KQErklc55x7mztDZTP2VK43G82gxy9OV3i6f-KR3GtA_TVEHC_w59_QMsItd0BoxE",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBYf4MUOAAd-hk0fxbGDXlnI2vgqwpoGNYCgVKyzkFaSt38DbuBXTKyYbw61ivVfsa5WJRNZIOUMB6kohhsgEOOR-zNoDd0g0WHlLSr97e64wd1v-v6-3aWrYHZsKUcaFE4vu9Zo24Qv3hTQJZL5FasTqq0lnU3JxvpicsuupV_zsd9OsFYCNqEyZbgwdWaY2Njg0MKcVz6DiB0dg_gryJMi96VMOFRqAlynNFCse5DgmjQ1aX3-Opzu9fAF-o3SD1MntFhxyedc08",
]

FEMALE_PLACEHOLDER_URLS = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuApZmVfVEj2iVnXnk-qVffQpWJXVNcWweAEqySyH-Tz20keo6X0kJ-Fkd1cBegf4BPCBjCpwVa3SJXwioFyi2ayfnA6QOrY-H1clZQi3ZUoG9F4XJl4HHr2sNll4wJC-b6mt8xg9oXu1kNI2uLGrvhG7gB9FKdsGlzTBwGdrgBctRL9Lii2LUHsF9XfXKaY2p2fvijmkAtKgwLBMBEZAVZhxKQ9-Fq1RWUoQWjrypxONYubvm2BcmmmEEZ62-6XsO_b5RVJ1T-k56s",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmp7IAnHPMXog6Gc48h2JKrjlW-aimb4DuDw5y40i3BV32uG1hk_9vtLHbMw2RzBFCjAYQ2BrB_M1lJ7IQN8eQ2RkslEhqzL6kmBMrFqZ_k8HB_C1P_fP6ozU5i_V2TIp7AI2YM40iA_zV4T4s5S8CBwoZfZ86HL5OqCa84zBlurgCPfr6k2j2t453QQSa-bqhL_jUDgLCB5O4TI5z53duEh7zPjmC4g4y_YjVzmrvbh-6jOYkhRuZOG_SWzufIma5iO4qnHXvMJ8",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB9k1z22MRpitbphBdBip0k5qANX2zIlGLmzGYBltub4kzgYPdoo1ouBS8vWeb-9IQnCdm9zs_cJQmnnhIci_GoamXUfRKggbpmoJBCPSJQ1CXayyB_VS8rLLyaL2xmKPNRatTQTwbBDACtsSHL5w2OqRHnVyMs_TLx2NQhuPRHk_lhs3zlFlGu7sU6WyczqhlBpYa0HIPwgwxwSmV2gaNn9CDF2v08jaaOTkhW3NuD4O2a4i4lK4X0KKHA2uFWEJWyfnBZ0X63T7M",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCkzmTSwAw1Wgzw3hLUVPFxvr4SAB5yGpoavrrJl39SnbEKKS7lPXw-PQTs_Tpdgl8WDUKubI0xkYVycOD83lShYuMiDKsKJoUWa7PGYpVcVeMPbqa2kAZyxbe29O0TIWjkrZjk7cr5MznNZ2gQ6lSAPjMe5_bioWwfxzwVOR6ZAzR2bUEtfFpI2n9uEl9XFNPopVdKx2MNgbBAwHtKIRX0Hiu2l-lMyMDIUnd1PGvHt4c7J-ghkpJt7X4TdoYpoBCDjzYwl05nwvk",
]

# In-memory cache: first_name_lower -> "male" | "female"
_gender_cache: dict[str, Literal["male", "female"]] = {}


def _hash_string(s: str) -> int:
    """Deterministic hash for index selection (same as frontend)."""
    h = 0
    normalized = (s or "").strip().lower()
    for char in normalized:
        h = (h << 5) - h + ord(char)
        h = h & 0xFFFFFFFF
    return abs(h)


def _first_name(full_name: str) -> str:
    """Extract first word (first name) lowercased."""
    if not full_name or not isinstance(full_name, str):
        return ""
    parts = full_name.strip().split()
    return (parts[0] or "").lower()


async def _classify_gender_by_llm(first_name: str) -> Literal["male", "female"]:
    """Call OpenRouter with minimal prompt to classify first name. Uses low-cost model and 5 max tokens."""
    client = OpenRouterClient()
    messages = [
        {
            "role": "system",
            "content": "Reply with exactly one word: male or female. No other text.",
        },
        {
            "role": "user",
            "content": f'What is the typical gender for the first name "{first_name}"? Reply only: male or female.',
        },
    ]
    try:
        response = await client.chat_completion(
            messages=messages,
            model="avatar_gender",
            temperature=0,
            max_tokens=5,
        )
        content = (response.content or "").strip().lower()
        if "female" in content:
            return "female"
        return "male"
    except OpenRouterError as e:
        logger.warning("Avatar gender classification failed for %r: %s", first_name, e)
        return "male"


async def get_placeholder_avatar_url(full_name: str) -> str:
    """
    Return a placeholder avatar URL for the given full name.
    Uses LLM to classify first name as male/female (cached), then picks URL by hash of full name.
    """
    full_name = (full_name or "").strip()
    if not full_name:
        return MALE_PLACEHOLDER_URLS[0]

    first = _first_name(full_name)
    if not first:
        return MALE_PLACEHOLDER_URLS[0]

    if first not in _gender_cache:
        _gender_cache[first] = await _classify_gender_by_llm(first)

    is_female = _gender_cache[first] == "female"
    urls = FEMALE_PLACEHOLDER_URLS if is_female else MALE_PLACEHOLDER_URLS
    index = _hash_string(full_name) % len(urls)
    return urls[index]
