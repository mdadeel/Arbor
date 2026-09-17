#!/usr/bin/env python3
"""
Memory Freshness Checker — Scans .ai/memory.md for stale entries.

Parses the markdown file, extracts section-level metadata
(*Last Updated*, *Confidence*, *Stale Since*), and reports
entries that need verification.

Usage:
    python scripts/check-memory-freshness.py                        # basic check
    python scripts/check-memory-freshness.py --ci                   # exit 1 if stale
    python scripts/check-memory-freshness.py --fix                  # auto-tag stale sections
    python scripts/check-memory-freshness.py --days 60              # custom threshold
    python scripts/check-memory-freshness.py --path path/to/memory.md
    python scripts/check-memory-freshness.py --verbose              # show all sections
    python scripts/check-memory-freshness.py --json                 # machine-readable output

Designed for CI pipelines (GitHub Actions, pre-commit hooks, etc.).
Zero external dependencies — Python 3.8+ stdlib only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import NamedTuple


# ─── Types ───────────────────────────────────────────────────────────────────

class Section(NamedTuple):
    """A parsed section from memory.md."""
    heading: str            # The ## heading text (or empty string)
    content: str            # Raw section content
    last_updated: datetime | None
    confidence: str         # "FACT", "INFERENCE", "UNKNOWN", or ""
    stale_since: datetime | None
    has_last_updated: bool
    has_confidence: bool
    has_stale_since: bool
    line_number: int        # Approximate line number in original file


class ReportRow(NamedTuple):
    heading: str
    status: str             # "FRESH", "STALE", "NO_DATE", "UNKNOWN", "ALREADY_STALE"
    last_updated: str       # Human-readable date
    days_ago: int | None    # Days since last update
    confidence: str
    detail: str             # Explanation for the status


# ─── Constants ───────────────────────────────────────────────────────────────

DEFAULT_THRESHOLD_DAYS = 30
DEFAULT_PATH = ".ai/memory.md"
STALE_TEMPLATE = """\
- **Confidence:** UNKNOWN — needs verification
- **Stale Since:** {date}
"""


# ─── Parsing ─────────────────────────────────────────────────────────────────

SECTION_SPLITTER = re.compile(r"\n---[\t ]*\n")
HEADING_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)
LAST_UPDATED_RE = re.compile(
    r"\*{1,2}Last Updated:\*{1,2}\s*(\d{4})-(\d{2})-(\d{2})", re.MULTILINE
)
CONFIDENCE_RE = re.compile(
    r"\*{1,2}Confidence:\*{1,2}\s*(FACT|INFERENCE|UNKNOWN)", re.MULTILINE
)
STALE_SINCE_RE = re.compile(
    r"\*{1,2}Stale Since:\*{1,2}\s*(\d{4})-(\d{2})-(\d{2})", re.MULTILINE
)

COMMENT_LINE_RE = re.compile(r"^\s*<!--.*-->")
FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)


def parse_date(year: str, month: str, day: str) -> datetime | None:
    """Parse a date string into a datetime object."""
    try:
        return datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
    except ValueError:
        return None


def strip_comments(text: str) -> str:
    """Remove HTML comments from text so they don't interfere with parsing."""
    # Remove <!-- --> comments (including multi-line)
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def parse_sections(filepath: str) -> tuple[list[Section], str | None]:
    """
    Parse memory.md into a list of Sections.
    Returns (sections, error_message).
    """
    if not os.path.exists(filepath):
        return [], f"File not found: {filepath}"

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()
    except (OSError, PermissionError) as e:
        return [], f"Cannot read {filepath}: {e}"

    if not raw.strip():
        return [], f"File is empty: {filepath}"

    # Remove YAML frontmatter if present
    cleaned = FRONTMATTER_RE.sub("", raw)

    # Split into sections
    raw_sections = SECTION_SPLITTER.split(cleaned)

    sections: list[Section] = []
    line_cursor = 0

    for raw_sec in raw_sections:
        stripped = raw_sec.strip()
        if not stripped:
            line_cursor += raw_sec.count("\n") + 1
            continue

        # Approximate line number
        section_start = cleaned.find(raw_sec, line_cursor)
        approx_line = cleaned[:section_start].count("\n") + 1 if section_start >= 0 else 0
        line_cursor = section_start + len(raw_sec) if section_start >= 0 else line_cursor

        # Strip comments for metadata extraction
        no_comments = strip_comments(stripped)

        # Extract heading
        heading_match = HEADING_RE.search(no_comments)
        heading = heading_match.group(1).strip() if heading_match else ""

        # Extract metadata
        lu_match = LAST_UPDATED_RE.search(no_comments)
        conf_match = CONFIDENCE_RE.search(no_comments)
        ss_match = STALE_SINCE_RE.search(no_comments)

        last_updated = (
            parse_date(lu_match.group(1), lu_match.group(2), lu_match.group(3))
            if lu_match else None
        )
        stale_since = (
            parse_date(ss_match.group(1), ss_match.group(2), ss_match.group(3))
            if ss_match else None
        )
        confidence = conf_match.group(1) if conf_match else ""

        sections.append(Section(
            heading=heading,
            content=stripped,
            last_updated=last_updated,
            confidence=confidence,
            stale_since=stale_since,
            has_last_updated=lu_match is not None,
            has_confidence=conf_match is not None,
            has_stale_since=ss_match is not None,
            line_number=approx_line,
        ))

    return sections, None


# ─── Analysis ────────────────────────────────────────────────────────────────

def analyze_sections(
    sections: list[Section],
    threshold_days: int,
    reference_date: datetime | None = None,
) -> list[ReportRow]:
    """
    Analyze sections for staleness.
    Returns a list of ReportRow entries sorted by status severity.
    """
    if reference_date is None:
        reference_date = datetime.now(timezone.utc)

    rows: list[ReportRow] = []

    for sec in sections:
        # Skip header/footer sections (no heading, no metadata)
        if not sec.heading and not sec.has_last_updated:
            continue

        # Already tagged as stale
        if sec.stale_since is not None:
            days = (reference_date - sec.stale_since).days
            rows.append(ReportRow(
                heading=sec.heading,
                status="ALREADY_STALE",
                last_updated=sec.last_updated.strftime("%Y-%m-%d") if sec.last_updated else "—",
                days_ago=days,
                confidence=sec.confidence,
                detail=f"Stale since {sec.stale_since.strftime('%Y-%m-%d')} ({days} days ago)",
            ))
            continue            # No Last Updated date
        if not sec.has_last_updated:
            location = f"(around line {sec.line_number})" if sec.line_number else ""
            heading_display = sec.heading or "(untitled section)"
            rows.append(ReportRow(
                heading=sec.heading,
                status="NO_DATE",
                last_updated="—",
                days_ago=None,
                confidence=sec.confidence,
                detail=f"No 'Last Updated' metadata found {location} — '{heading_display}' needs initial documentation",
            ))
            continue

        # Confidence is UNKNOWN
        if sec.confidence == "UNKNOWN":
            rows.append(ReportRow(
                heading=sec.heading,
                status="UNKNOWN",
                last_updated=sec.last_updated.strftime("%Y-%m-%d") if sec.last_updated else "—",
                days_ago=None,
                confidence=sec.confidence,
                detail="Tagged as UNKNOWN — needs verification",
            ))
            continue

        # Check freshness
        if sec.last_updated is not None:
            days_ago = (reference_date - sec.last_updated).days
            date_str = sec.last_updated.strftime("%Y-%m-%d")

            if days_ago > threshold_days:
                rows.append(ReportRow(
                    heading=sec.heading,
                    status="STALE",
                    last_updated=date_str,
                    days_ago=days_ago,
                    confidence=sec.confidence,
                    detail=f"Last updated {date_str} ({days_ago} days ago, threshold: {threshold_days})",
                ))
            else:
                rows.append(ReportRow(
                    heading=sec.heading,
                    status="FRESH",
                    last_updated=date_str,
                    days_ago=days_ago,
                    confidence=sec.confidence,
                    detail=f"Last updated {date_str} ({days_ago} days ago)",
                ))
        else:
            # Has Last Updated metadata but couldn't parse
            rows.append(ReportRow(
                heading=sec.heading,
                status="NO_DATE",
                last_updated="—",
                days_ago=None,
                confidence=sec.confidence,
                detail="Could not parse 'Last Updated' date",
            ))

    return rows


# ─── Auto-Fix ────────────────────────────────────────────────────────────────

def auto_fix_stale(filepath: str, rows: list[ReportRow], reference_date: datetime) -> int:
    """
    Automatically tag stale sections with UNKNOWN Confidence and Stale Since date.
    Returns number of sections fixed.

    Note: Splits and rejoins on `---` separators, which normalizes any trailing
    whitespace on separator lines (e.g. `---  ` becomes `---`). This is a benign
    formatting change and is not expected to cause issues.
    """
    if not os.path.exists(filepath):
        print(f"❌ Cannot fix: {filepath} not found")
        return 0

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    fixed_count = 0
    sections_raw = SECTION_SPLITTER.split(content)

    # Collect stale sections that need fixing
    stale_entries = [r for r in rows if r.status in ("STALE", "NO_DATE", "UNKNOWN")]

    if not stale_entries:
        print("✓ No stale entries to fix")
        return 0

    # Build date string for stale tag
    today_str = reference_date.strftime("%Y-%m-%d")
    stale_tag = f"- **Confidence:** UNKNOWN — needs verification\n- **Stale Since:** {today_str}"

    for entry in stale_entries:
        if not entry.heading:
            continue

        # Find the section by heading
        heading_pattern = f"## {re.escape(entry.heading)}"
        for i, sec_raw in enumerate(sections_raw):
            if re.search(heading_pattern, sec_raw):
                # Check if stale metadata already present
                has_stale = re.search(r"\*{1,2}Stale Since:\*{1,2}", sec_raw)
                if has_stale:
                    continue  # Already tagged

                # Try to insert stale_tag right after the Confidence line
                lines = sec_raw.split("\n")
                inserted = False

                for j, line in enumerate(lines):
                    if re.match(r"\s*\*{1,2}Confidence:\*{1,2}", line):
                        sections_raw[i] = sec_raw.replace(
                            line,
                            line + "\n" + stale_tag,
                            1,
                        )
                        inserted = True
                        fixed_count += 1
                        break

                if not inserted:
                    # No Confidence line found — append at end of section
                    sections_raw[i] = sec_raw.rstrip() + "\n\n" + stale_tag + "\n"
                    fixed_count += 1

                break

    # Write back — note: this normalizes any trailing whitespace on `---` lines
    new_content = "\n---\n".join(sections_raw)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)

    return fixed_count


# ─── Output ──────────────────────────────────────────────────────────────────

def print_header(filepath: str, threshold: int, ref_date: datetime) -> None:
    """Print a styled header box."""
    date_str = ref_date.strftime("%Y-%m-%d")
    width = 58
    print("┌" + "─" * width + "┐")
    print(f"│  Memory Freshness Check{' ' * (width - 24)}│")
    print(f"│  File: {filepath}{' ' * (width - 6 - len(filepath))}│")
    print(f"│  Threshold: {threshold} days{' ' * (width - 15 - len(str(threshold)))}│")
    print(f"│  Checked: {date_str}{' ' * (width - 10 - len(date_str))}│")
    print("└" + "─" * width + "┘")
    print()


def print_stale_section(rows: list[ReportRow]) -> None:
    """Print sections that need attention."""
    stale = [r for r in rows if r.status in ("STALE", "NO_DATE", "UNKNOWN", "ALREADY_STALE")]
    if not stale:
        return

    print("SECTIONS NEEDING ATTENTION:")
    print("━" * 60)
    print()

    for row in stale:
        if row.status == "STALE":
            print(f"  ❌  {row.heading or '(untitled section)'}")
            print(f"      {row.detail}")
        elif row.status == "ALREADY_STALE":
            print(f"  ⏳  {row.heading or '(untitled section)'}")
            print(f"      {row.detail}")
        elif row.status == "NO_DATE":
            print(f"  ⚠️   {row.heading or '(untitled section)'}")
            print(f"      {row.detail}")
        elif row.status == "UNKNOWN":
            print(f"  ❓  {row.heading or '(untitled section)'}")
            print(f"      {row.detail}")
        if row.confidence:
            print(f"      Confidence: {row.confidence}")
        print()


def print_fresh_section(rows: list[ReportRow]) -> None:
    """Print fresh sections summary."""
    fresh = [r for r in rows if r.status == "FRESH"]
    if not fresh:
        return

    print("FRESH SECTIONS:")
    print("━" * 60)
    for row in fresh:
        print(f"  ✓  {row.heading or '(untitled section)'} ({row.detail})")
    print()


def print_summary(rows: list[ReportRow]) -> tuple[int, int, int, int]:
    """Print overall summary and return counts."""
    fresh = sum(1 for r in rows if r.status == "FRESH")
    stale = sum(1 for r in rows if r.status == "STALE")
    no_date = sum(1 for r in rows if r.status == "NO_DATE")
    unknown = sum(1 for r in rows if r.status == "UNKNOWN")
    already_stale = sum(1 for r in rows if r.status == "ALREADY_STALE")

    total_issues = stale + no_date + unknown

    print("─" * 60)
    print(f"  Summary: {fresh} fresh, {stale} stale, {no_date} missing date, "
          f"{unknown} UNKNOWN, {already_stale} already stale")
    print()

    if total_issues == 0:
        print("  ✅  All sections are fresh!")
    else:
        print(f"  ⚠️   {total_issues} section(s) need attention.")
    print()

    return fresh, stale, no_date, unknown


# ─── Main ────────────────────────────────────────────────────────────────────

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check .ai/memory.md for stale entries older than N days.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s                          # basic check\n"
            "  %(prog)s --ci                     # exit 1 if stale\n"
            "  %(prog)s --fix                    # auto-tag stale sections\n"
            "  %(prog)s --days 60                # custom threshold\n"
            "  %(prog)s --path .ai/memory.md     # custom path\n"
            "  %(prog)s --verbose                # show all sections\n"
            "  %(prog)s --json                   # machine-readable output\n"
        ),
    )
    parser.add_argument(
        "--days", type=int, default=DEFAULT_THRESHOLD_DAYS,
        help=f"Staleness threshold in days (default: {DEFAULT_THRESHOLD_DAYS})",
    )
    parser.add_argument(
        "--path", type=str, default=DEFAULT_PATH,
        help=f"Path to memory.md (default: {DEFAULT_PATH})",
    )
    parser.add_argument(
        "--ci", action="store_true",
        help="CI mode: exit code 1 if any stale entries found",
    )
    parser.add_argument(
        "--fix", action="store_true",
        help="Auto-tag stale sections with UNKNOWN Confidence and Stale Since date (modifies file in-place; use --dry-run to preview)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview --fix output without modifying the file (implies --fix)",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Show all sections including fresh ones",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output results as JSON (machine-readable)",
    )
    parser.add_argument(
        "--ref-date", type=str, default=None,
        help="Reference date (YYYY-MM-DD) for testing. Defaults to today.",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    # Resolve reference date
    if args.ref_date:
        try:
            parts = args.ref_date.split("-")
            reference_date = datetime(int(parts[0]), int(parts[1]), int(parts[2]), tzinfo=timezone.utc)
        except (ValueError, IndexError):
            print(f"❌ Invalid --ref-date format: {args.ref_date}. Use YYYY-MM-DD.")
            return 2
    else:
        reference_date = datetime.now(timezone.utc)

    # Resolve filepath
    filepath = os.path.abspath(args.path)

    # Parse
    sections, error = parse_sections(filepath)
    if error:
        print(f"❌ {error}")
        return 1 if args.ci else 0

    if not sections:
        print(f"⚠️  No sections found in {filepath}.")
        return 0

    # Analyze
    rows = analyze_sections(sections, args.days, reference_date)

    # Collect counts
    stale_count = sum(1 for r in rows if r.status == "STALE")
    no_date_count = sum(1 for r in rows if r.status == "NO_DATE")
    unknown_count = sum(1 for r in rows if r.status == "UNKNOWN")
    already_stale_count = sum(1 for r in rows if r.status == "ALREADY_STALE")
    fresh_count = sum(1 for r in rows if r.status == "FRESH")
    total_issues = stale_count + no_date_count + unknown_count

    # JSON output
    if args.json:
        output = {
            "file": filepath,
            "threshold_days": args.days,
            "reference_date": reference_date.strftime("%Y-%m-%d"),
            "total_sections": len(rows),
            "fresh": fresh_count,
            "stale": stale_count,
            "missing_date": no_date_count,
            "unknown": unknown_count,
            "already_stale": already_stale_count,
            "needs_attention": total_issues,
            "sections": [
                {
                    "heading": r.heading,
                    "status": r.status,
                    "last_updated": r.last_updated,
                    "days_ago": r.days_ago,
                    "confidence": r.confidence,
                    "detail": r.detail,
                }
                for r in rows
            ],
        }
        print(json.dumps(output, indent=2))
        return 1 if args.ci and total_issues > 0 else 0

    # Human-readable output
    print_header(filepath, args.days, reference_date)

    # --dry-run mode (preview what --fix would do without writing)
    if args.dry_run:
        stale_headings = [r for r in rows if r.status in ("STALE", "NO_DATE", "UNKNOWN") and r.heading]
        if stale_headings:
            print("  🔍 DRY RUN — would tag the following sections as stale:")
            print()
            for r in stale_headings:
                print(f"      • {r.heading}")
            print()
            print(f"  Would tag {len(stale_headings)} section(s). Use --fix to apply.")
        else:
            print("  🔍 DRY RUN — no sections would be tagged.")
        print()

    # --fix mode
    if args.fix and not args.dry_run:
        fixed = auto_fix_stale(filepath, rows, reference_date)
        print(f"  🔧 Auto-fix: {fixed} section(s) tagged as stale.")
        print()
        # Re-parse and re-analyze after fix
        if fixed > 0:
            sections, error = parse_sections(filepath)
            if sections:
                rows = analyze_sections(sections, args.days, reference_date)
                fresh_count = sum(1 for r in rows if r.status == "FRESH")
                stale_count = sum(1 for r in rows if r.status == "STALE")
                no_date_count = sum(1 for r in rows if r.status == "NO_DATE")
                unknown_count = sum(1 for r in rows if r.status == "UNKNOWN")
                already_stale_count = sum(1 for r in rows if r.status == "ALREADY_STALE")
                total_issues = stale_count + no_date_count + unknown_count

    # Print sections needing attention
    attention = [r for r in rows if r.status in ("STALE", "NO_DATE", "UNKNOWN", "ALREADY_STALE")]
    if attention:
        print_stale_section(rows)

    # Print fresh sections (only in verbose mode)
    if args.verbose:
        print_fresh_section(rows)
    elif fresh_count > 0 and total_issues == 0:
        # In non-verbose mode, just show a summary line
        pass

    # Summary
    print_summary(rows)

    # Exit code
    if args.ci and total_issues > 0:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
