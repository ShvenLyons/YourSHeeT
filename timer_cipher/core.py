"""Core reversible encoding for minute-level time ranges.

TimeR is intentionally compact: it produces exactly four letters. The
algorithm is a keyed, reversible permutation over a four-letter alphabet
space. It is useful for demos and lightweight obfuscation, not for
high-security cryptography.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import gcd
from string import ascii_lowercase, ascii_uppercase
import re

ALPHABET = ascii_lowercase + ascii_uppercase
BASE = len(ALPHABET)
CODE_LENGTH = 4
MODULUS = BASE**CODE_LENGTH
MINUTES_PER_DAY = 24 * 60
END_BUCKETS = MINUTES_PER_DAY + 1
NO_END = None
RANGE_COUNT = MINUTES_PER_DAY * END_BUCKETS
PAIR_COUNT = RANGE_COUNT
FNV64_OFFSET = 14695981039346656037
FNV64_PRIME = 1099511628211
FNV64_MASK = (1 << 64) - 1

ANCHOR_KEY = "dog"
ANCHOR_START = "19:26"
ANCHOR_END = "19:30"
ANCHOR_CODE = "absd"

_TIME_RE = re.compile(r"^\s*(\d{1,2})\s*(?::|\uff1a)\s*(\d{1,2})\s*$")


@dataclass(frozen=True)
class TimeRange:
    """A decoded time range represented as minute offsets from midnight."""

    start_minute: int
    end_minute: int | None

    @property
    def start(self) -> str:
        return format_time(self.start_minute)

    @property
    def end(self) -> str:
        if self.end_minute is NO_END:
            return "N/A"
        return format_time(self.end_minute)

    @property
    def has_end(self) -> bool:
        return self.end_minute is not NO_END

    def __str__(self) -> str:
        return f"{self.start}-{self.end}"


def parse_time(value: str | int) -> int:
    """Parse HH:MM into minutes after midnight."""

    if isinstance(value, int):
        minute = value
    elif isinstance(value, str):
        match = _TIME_RE.match(value)
        if not match:
            raise ValueError(f"invalid time {value!r}; expected HH:MM")
        hour = int(match.group(1))
        minute_part = int(match.group(2))
        if hour > 23 or minute_part > 59:
            raise ValueError(f"invalid time {value!r}; expected 00:00 through 23:59")
        minute = hour * 60 + minute_part
    else:
        raise TypeError("time must be a string or minute integer")

    if not 0 <= minute < MINUTES_PER_DAY:
        raise ValueError("minute integer must be in [0, 1439]")
    return minute


def format_time(minute: int) -> str:
    """Format minutes after midnight as HH:MM."""

    if not 0 <= minute < MINUTES_PER_DAY:
        raise ValueError("minute integer must be in [0, 1439]")
    hour, minute_part = divmod(minute, 60)
    return f"{hour:02d}:{minute_part:02d}"


def encrypt_interval(
    start: str | int,
    end: str | int | None = NO_END,
    key: str = ANCHOR_KEY,
) -> str:
    """Encrypt a time range into a four-letter code."""

    start_minute = parse_time(start)
    end_minute = parse_optional_end(end)
    rank = _rank_interval(start_minute, end_minute)
    multiplier, offset = _key_parameters(key)
    return _value_to_code((multiplier * rank + offset) % MODULUS)


def decrypt_code(code: str, key: str = ANCHOR_KEY) -> TimeRange:
    """Decrypt a four-letter code into a TimeRange."""

    value = _code_to_value(code)
    multiplier, offset = _key_parameters(key)
    inverse = pow(multiplier, -1, MODULUS)
    rank = ((value - offset) * inverse) % MODULUS

    if rank >= RANGE_COUNT:
        raise ValueError("ciphertext is not a valid TimeR code for this key")

    start_minute, end_minute = _unrank_interval(rank)
    return TimeRange(start_minute, end_minute)


def parse_optional_end(value: str | int | None) -> int | None:
    """Parse an end time, accepting blank/N/A as no follow-up."""

    if value is NO_END:
        return NO_END
    if isinstance(value, str) and value.strip().lower() in {"", "n/a", "na", "none", "null", "-"}:
        return NO_END
    return parse_time(value)


def _rank_interval(start_minute: int, end_minute: int | None) -> int:
    end_bucket = MINUTES_PER_DAY if end_minute is NO_END else end_minute
    return start_minute * END_BUCKETS + end_bucket


def _unrank_interval(rank: int) -> tuple[int, int | None]:
    if not 0 <= rank < RANGE_COUNT:
        raise ValueError("rank is outside the supported time range space")
    start_minute, end_bucket = divmod(rank, END_BUCKETS)
    end_minute = NO_END if end_bucket == MINUTES_PER_DAY else end_bucket
    return start_minute, end_minute


def _key_parameters(key: str) -> tuple[int, int]:
    multiplier = _key_multiplier(key)
    offset = (_raw_offset(key) + _ANCHOR_CALIBRATION) % MODULUS
    return multiplier, offset


def _key_multiplier(key: str) -> int:
    candidate = _hash_int(key, "multiplier") % MODULUS
    candidate |= 1

    while gcd(candidate, MODULUS) != 1:
        candidate = (candidate + 2) % MODULUS
        if candidate == 0:
            candidate = 1

    return candidate


def _raw_offset(key: str) -> int:
    return _hash_int(key, "offset") % MODULUS


def _hash_int(key: str, purpose: str) -> int:
    if not isinstance(key, str) or not key:
        raise ValueError("key must be a non-empty string")

    value = FNV64_OFFSET
    payload = f"TimeR:{purpose}:{key}".encode("utf-8")
    for byte in payload:
        value ^= byte
        value = (value * FNV64_PRIME) & FNV64_MASK
    return value


def _value_to_code(value: int) -> str:
    if not 0 <= value < MODULUS:
        raise ValueError("cipher value is outside the four-letter code space")

    chars: list[str] = []
    for _ in range(CODE_LENGTH):
        value, index = divmod(value, BASE)
        chars.append(ALPHABET[index])
    return "".join(reversed(chars))


def _code_to_value(code: str) -> int:
    if not isinstance(code, str):
        raise TypeError("code must be a string")
    if len(code) != CODE_LENGTH:
        raise ValueError(f"code must contain exactly {CODE_LENGTH} letters")

    value = 0
    for char in code:
        index = ALPHABET.find(char)
        if index < 0:
            raise ValueError(f"invalid code character {char!r}")
        value = value * BASE + index
    return value


def _calibration() -> int:
    anchor_rank = _rank_interval(parse_time(ANCHOR_START), parse_time(ANCHOR_END))
    target_value = _code_to_value(ANCHOR_CODE)
    anchor_value = _key_multiplier(ANCHOR_KEY) * anchor_rank + _raw_offset(ANCHOR_KEY)
    return (target_value - anchor_value) % MODULUS


_ANCHOR_CALIBRATION = _calibration()
