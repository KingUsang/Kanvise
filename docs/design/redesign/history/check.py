#!/usr/bin/env python3
"""Consistency checker for the Kanvise redesign specs (stdlib only).

Usage:
    python3 check.py <redesign-folder> [--only ids|terms]

Checks
  ids   (a) duplicate state IDs defined in headings like `## LP-01 · Lesson page`
        (b) references to IDs that no heading defines
        (c) retired ID prefixes (LS-, ST-) anywhere
  terms (d) banned terms, with exceptions configured in ALLOW below
        (e) the em dash character (U+2014), no exceptions

Exit code 0 when every selected check is clean, 1 otherwise.

Banned terms are matched per "unit" (a paragraph, list item, table row or
fenced line), so phrases wrapped over two lines are still caught. An ALLOW
entry blanks out the text its regex matches before banned terms are searched,
so it can exempt a single phrase or (with ^.*$ style patterns) a whole unit.
"""

import argparse
import fnmatch
import os
import re
import sys
from collections import defaultdict

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

# Prefixes a body reference may use. LS and ST are retired (see RETIRED).
REF_PREFIXES = [
    "SH", "ONB", "SET", "DB", "CRS", "CW", "DIAG", "LL", "LW", "LP", "CAL",
    "STU", "CR", "SM", "SA", "HW", "QZ", "CFG", "BL", "RS", "R", "REC", "NTF",
    "TM", "DM",
]
RETIRED_PREFIXES = ["LS", "ST"]

# name -> regex (case-insensitive, word boundaries)
BANNED = {
    "learner": r"\blearners?\b",
    "live class": r"\blive\s+class(?:es)?\b",
    "report": r"\breports?\b",
    "parent": r"\bparents?(?:'s)?\b",
    "guardian": r"\bguardians?\b",
    "observer": r"\bobservers?\b",
    "waiting room": r"\bwaiting\s+rooms?\b",
    "let each one in": r"\blet\s+each\s+one\s+in\b",
    "tutoring account": r"\btutoring\s+accounts?\b",
    "exam board name": r"\b(?:WAEC|JAMB|NECO)\b",
}

# (file glob, regex). Text matched by the regex is ignored by the banned-term
# check. Keep entries narrow and say why.
ALLOW = [
    # Inline code: routes, file names and database names keep old words
    # (00 section 13: "Routes and database names stay as they are").
    ("*", r"`[^`]*`"),
    # The classroom action is called Report a concern.
    ("*", r"(?i)\breport\s+a\s+concern\b"),
    # Quoted name of the old feedback link that Share feedback replaces.
    ("*", r"(?i)\"report\s+a\s+problem\""),
    # "a toast reports when done" is the verb, not a lesson report.
    ("*", r"(?i)\btoast\s+reports\b"),
    # Statements that there is no waiting room, or that PlugNmeet's is off.
    ("*", r"(?i)\b(?:no|without)\s+(?:\w+\s+){0,2}waiting\s+rooms?\b"),
    ("*", r"(?i)\bwaiting\s+rooms?\s+(?:\w+\s+){0,2}off\b"),
    # Account switcher is the one place "tutoring account" is allowed.
    ("*", r"(?i)^.*\baccount\s+switcher\b.*$"),
    # 00 decisions: the rules that name the banned words.
    ("00-decisions.md", r"(?i)\bnot\s+learners?\b"),
    ("00-decisions.md", r"(?i)\"learner\s+model\""),
    ("00-decisions.md", r"(?i)\"tutoring account\"\s+only\b"),
    ("00-decisions.md", r"(?i)search\s+also\s+matches\s+\"live\s+class\""),
    ("00-decisions.md", r"(?i)\bparents?\s+(?:are|is)\s+(?:out\s+of\s+scope|retired)\b"),
    ("00-decisions.md", r"(?i)\breport\s+approvals\b"),
    # 00 decisions: amendment and retired tables or bullets describe old things.
    ("00-decisions.md", r"(?i)^.*\b(?:retired?|out\s+of\s+scope)\b.*$"),
    # 14 inventory: rows that retire, replace or merge an old feature may name it.
    ("14-old-flows-inventory.md", r"(?i)^\|.*\|\s*(?:retire|replace|merge)\b.*$"),
    ("14-old-flows-inventory.md", r"(?i)^.*\bparents?\s+(?:are|is)\s+(?:out\s+of\s+scope|retired)\b.*$"),
    ("14-old-flows-inventory.md", r"\b(?:WAEC|JAMB|NECO)\b"),
]

EM_DASH = "\u2014"

ID_RE = r"[A-Z]{1,4}-[0-9A-Za-z]+"
HEADING_RE = re.compile(
    r"^#{1,4}\s+(" + ID_RE + r")"
    r"(?:\s*(?:…|\.\.\.|–|to)\s*(" + ID_RE + r"))?\s*·"
)
REF_RE = re.compile(
    r"\b(" + "|".join(sorted(REF_PREFIXES, key=len, reverse=True)) + r")"
    r"-([0-9][0-9A-Za-z]*|[A-Z]{1,2})\b"
)
RETIRED_RE = re.compile(
    r"\b(" + "|".join(RETIRED_PREFIXES) + r")-[0-9A-Za-z]+\b"
)
UNIT_START_RE = re.compile(r"^\s*(?:#|\||[-*+]\s|\d+[.)]\s|```|~~~)")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def expand_range(first, last):
    """ONB-02 … ONB-06 -> ONB-02..ONB-06. Falls back to the two ends."""
    p1, s1 = first.split("-", 1)
    p2, s2 = last.split("-", 1)
    if p1 == p2 and s1.isdigit() and s2.isdigit() and int(s1) <= int(s2):
        width = len(s1)
        return [f"{p1}-{n:0{width}d}" for n in range(int(s1), int(s2) + 1)]
    return [first, last]


def load(folder):
    files = sorted(f for f in os.listdir(folder) if f.endswith(".md"))
    out = {}
    for name in files:
        with open(os.path.join(folder, name), encoding="utf-8") as fh:
            out[name] = fh.read().splitlines()
    return out


def units(lines):
    """Yield (start_lineno, [(lineno, text), ...]) groups for term matching."""
    cur = []
    in_fence = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            if cur:
                yield cur
                cur = []
            in_fence = not in_fence
            continue
        if in_fence:
            yield [(i, line)]
            continue
        if not stripped:
            if cur:
                yield cur
                cur = []
            continue
        if UNIT_START_RE.match(line) and cur:
            yield cur
            cur = []
        cur.append((i, line))
        if stripped.startswith("#") or stripped.startswith("|"):
            yield cur
            cur = []
    if cur:
        yield cur


def blank(match):
    return " " * len(match.group(0))


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def check_ids(docs):
    defined = defaultdict(list)  # id -> [(file, line)]
    for name, lines in docs.items():
        for i, line in enumerate(lines, 1):
            m = HEADING_RE.match(line)
            if not m:
                continue
            ids = expand_range(m.group(1), m.group(2)) if m.group(2) else [m.group(1)]
            for sid in ids:
                defined[sid].append((name, i))

    duplicates = {k: v for k, v in defined.items() if len(v) > 1}

    # A prefix must belong to one spec file (ST- in 06 and 12 is a collision).
    prefix_files = defaultdict(set)
    for sid, locs in defined.items():
        for f, _ in locs:
            prefix_files[sid.split("-", 1)[0]].add(f)
    collisions = {p: sorted(fs) for p, fs in prefix_files.items() if len(fs) > 1}

    undefined = defaultdict(list)
    retired = defaultdict(list)
    for name, lines in docs.items():
        for i, line in enumerate(lines, 1):
            for m in REF_RE.finditer(line):
                token = m.group(0)
                if token not in defined:
                    undefined[token].append((name, i))
            for m in RETIRED_RE.finditer(line):
                retired[m.group(0)].append((name, i))
    return defined, duplicates, collisions, undefined, retired


def check_terms(docs):
    compiled_allow = [(g, re.compile(r)) for g, r in ALLOW]
    compiled_banned = {k: re.compile(v, re.IGNORECASE) for k, v in BANNED.items()}
    hits = defaultdict(list)  # term -> [(file, line, snippet)]
    dashes = []
    for name, lines in docs.items():
        for i, line in enumerate(lines, 1):
            if EM_DASH in line:
                dashes.append((name, i, line.strip()))
        allows = [rx for g, rx in compiled_allow if fnmatch.fnmatch(name, g)]
        for unit in units(lines):
            offsets = []
            parts = []
            pos = 0
            for lineno, text in unit:
                offsets.append((pos, lineno))
                parts.append(text)
                pos += len(text) + 1
            joined = " ".join(parts)
            masked = joined
            for rx in allows:
                masked = rx.sub(blank, masked)
            for term, rx in compiled_banned.items():
                for m in rx.finditer(masked):
                    lineno = unit[0][0]
                    for start, ln in offsets:
                        if start <= m.start():
                            lineno = ln
                    a = max(0, m.start() - 50)
                    b = min(len(joined), m.end() + 50)
                    hits[term].append((name, lineno, " ".join(joined[a:b].split())))
    return hits, dashes


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

def where(locs):
    return ", ".join(f"{f}:{ln}" for f, ln in locs)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("folder")
    ap.add_argument("--only", choices=["ids", "terms"])
    args = ap.parse_args()

    if not os.path.isdir(args.folder):
        print(f"Not a folder: {args.folder}", file=sys.stderr)
        return 2

    docs = load(args.folder)
    failed = False
    summary = []

    if args.only in (None, "ids"):
        defined, duplicates, collisions, undefined, retired = check_ids(docs)
        print(f"== IDs: {len(defined)} defined in headings across {len(docs)} files")

        print(f"\n-- Duplicate state IDs: {len(duplicates)}")
        for sid in sorted(duplicates):
            print(f"  {sid}: {where(duplicates[sid])}")

        print(f"\n-- Prefixes defined in more than one file: {len(collisions)}")
        for p in sorted(collisions):
            print(f"  {p}-: {', '.join(collisions[p])}")

        print(f"\n-- Undefined references: {len(undefined)}")
        for sid in sorted(undefined):
            print(f"  {sid}: {where(undefined[sid])}")

        n_retired = sum(len(v) for v in retired.values())
        print(f"\n-- Retired prefixes (LS-, ST-): {len(retired)} IDs, {n_retired} uses")
        for sid in sorted(retired):
            print(f"  {sid}: {where(retired[sid])}")

        summary += [
            f"duplicate IDs {len(duplicates)}",
            f"prefix collisions {len(collisions)}",
            f"undefined refs {len(undefined)}",
            f"retired-prefix uses {n_retired}",
        ]
        failed |= bool(duplicates or collisions or undefined or retired)

    if args.only in (None, "terms"):
        hits, dashes = check_terms(docs)
        total = sum(len(v) for v in hits.values())
        print(f"\n== Banned terms: {total} hits")
        for term in BANNED:
            if not hits.get(term):
                continue
            print(f"\n-- {term}: {len(hits[term])}")
            for f, ln, snip in hits[term]:
                print(f"  {f}:{ln}: {snip}")

        print(f"\n== Em dashes (U+2014): {len(dashes)}")
        for f, ln, text in dashes:
            print(f"  {f}:{ln}: {text[:120]}")

        per_term = ", ".join(f"{t} {len(v)}" for t, v in hits.items() if v)
        summary += [f"banned terms {total}" + (f" ({per_term})" if per_term else ""),
                    f"em dashes {len(dashes)}"]
        failed |= bool(total or dashes)

    print("\n== Summary: " + "; ".join(summary))
    print("RESULT: " + ("FAIL" if failed else "PASS"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
