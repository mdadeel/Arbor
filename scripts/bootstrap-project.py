#!/usr/bin/env python3
"""
AI Workspace OS — Project Bootstrap

Generates a complete CLAUDE.md + .ai/ directory for any project.
Prompts for project details and fills in all placeholders automatically.

Usage:
    python scripts/bootstrap-project.py                          # Interactive mode
    python scripts/bootstrap-project.py --target /path/to/project
    python scripts/bootstrap-project.py --name "MyApp" --desc "An iOS app"
    python scripts/bootstrap-project.py --non-interactive        # Use defaults for missing flags

Supports:
    --target DIR       Target directory (default: current directory)
    --name NAME        Project name
    --desc DESC        One-line project description
    --stack STACK      Tech stack (e.g. "React, Node.js, PostgreSQL")
    --priority PRIO    Current priority (default: "Initial project setup")
    --non-interactive  Skip prompts, use provided flags or defaults
    --dry-run          Show what would be created without writing
"""

import argparse
import os
import sys
from datetime import date
from pathlib import Path
from typing import Optional

# ─── Templates ───────────────────────────────────────────────────────────────

CONTEXT_MD = """# Project Context

**Project:** {name} — {description}

**Tech Stack:** {stack}

**Current Priority:** {priority}

**Key Links:**
- <!-- Add link to docs -->
- <!-- Add link to design files -->
- <!-- Add link to project board -->

---

*Update this file when the project scope, priorities, or tech stack changes. Target: under 300 words.*
"""

ARCHITECTURE_MD = """# Project Architecture

## System Overview

<!-- High-level description of what this project does, its architecture style, and major components. -->

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | {frontend} | User interface |
| Backend | {backend} | API and business logic |
| Database | {database} | Data persistence |
| Infra | <!-- Platform --> | <!-- Role --> |

## Key Boundaries

| Layer | Location | Purpose |
|-------|----------|---------|
| <!-- API | Presentation | Handles HTTP requests --> | <!-- Controllers/, routes/ --> | <!-- Entry point --> |
| <!-- Service | Business Logic | Domain rules, orchestration --> | <!-- Services/ --> | <!-- Core logic --> |
| <!-- Data | Persistence | Database access, repositories --> | <!-- Repositories/, models/ --> | <!-- Data access --> |

## Data Flow

<!-- Describe the request/response flow through the system. Include a diagram if helpful. -->

```
[Client] → [API Gateway] → [Controller] → [Service] → [Repository] → [Database]
```

## Module Structure

<!-- List major modules and their responsibilities. This should grow as the codebase grows. -->

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| <!-- Auth --> | <!-- Authn/z, sessions --> | <!-- auth/ --> |
| <!-- Users --> | <!-- User management --> | <!-- users/ --> |
| <!-- Core domain --> | <!-- Business logic --> | <!-- core/ --> |

---

*Update this file when the architecture changes — new subsystems, layer changes, or data flow modifications. Hard requirement of finishing any task that modifies architecture.*
"""

MEMORY_MD = """# Project Memory

> **Purpose:** Persistent project knowledge that accumulates across sessions and AI tools.
> **Freshness:** Each section carries verification metadata. Stale entries are flagged.
> **Confidence tags:** FACT | INFERENCE | UNKNOWN (see CLAUDE.md Confidence Labeling)

---

## Project Summary

{name}: {description}

*Last Updated:* {today}
*Confidence:* FACT

---

## Architecture Summary

<!-- High-level system design, key patterns, tech stack. -->

*Last Updated:* {today}
*Confidence:* FACT

---

## Business Domains

| Domain | Description | Key Module(s) |
|--------|-------------|---------------|
| <!-- Domain --> | <!-- Description --> | <!-- Modules --> |

*Last Updated:* {today}
*Confidence:* FACT

---

## Coding Conventions

<!-- Naming, formatting, file organization, import style, lint rules. -->

*Last Updated:* {today}
*Confidence:* FACT

### Naming Conventions

- Files: <!-- e.g., kebab-case, PascalCase for components -->
- Functions: <!-- e.g., camelCase -->
- Classes: <!-- e.g., PascalCase -->
- Types/Interfaces: <!-- e.g., PascalCase prefixed with I? -->
- Constants: <!-- e.g., UPPER_SNAKE_CASE -->

### File Organization

<!-- How are files structured? Per-feature? Per-layer? -->

### Imports

<!-- Import ordering rules, absolute vs. relative paths, barrel files? -->

---

## Discovered Patterns

<!-- Links to Pattern Library entries. See CLAUDE.md Pattern Library section. -->

*Last Updated:* {today}
*Confidence:* FACT

| Pattern | Purpose | First Used | File Reference |
|---------|---------|------------|----------------|
| <!-- Pattern Name --> | <!-- Brief description --> | <!-- Commit/Date --> | <!-- File path --> |

---

## Authentication Flow

<!-- Auth mechanism, token handling, session management, roles/permissions. -->

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

---

## API Conventions

<!-- Endpoint structure, request/response shapes, error format, versioning. -->

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

### Endpoint Structure

<!-- Base URL, versioning, resource naming -->

### Request/Response Format

<!-- Standard envelope, pagination, error shape -->

### Error Codes

| Code | Meaning |
|------|---------|
| <!-- Code --> | <!-- Description --> |

---

## UI Conventions

<!-- Component library, design system tokens, layout patterns, responsive strategy. -->

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

### Design Tokens

- Primary color:
- Secondary color:
- Font stack:
- Spacing scale:
- Border radius:
- Shadow levels:

### Layout Patterns

<!-- Page layout, grid system, breakpoints -->

### Component Patterns

<!-- How components are structured, props conventions, composition patterns -->

---

## Backend Conventions

<!-- Service layer patterns, repository patterns, middleware, validation. -->

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

### Service Layer

<!-- How business logic is organized -->

### Data Access

<!-- Repository pattern, ORM usage, query conventions -->

### Middleware

<!-- Middleware chain, ordering, common middleware -->

---

## Important Modules

| Module | Purpose | Entry Points | Dependencies | Key Files |
|--------|---------|--------------|--------------|-----------|
| <!-- Name --> | <!-- Purpose --> | <!-- Public APIs --> | <!-- Deps --> | <!-- Files --> |

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

### Module: <!-- Name -->

**Purpose:**

**Entry Points:**

**Dependencies:**

**Public APIs:**

**Important Files:**

**Known Limitations:**

**Implementation Patterns Used:**

---

## Reusable Implementation Patterns

<!-- Pattern library entries. Each pattern follows the template from CLAUDE.md Pattern Library section. -->

*Last Updated:* {today}
*Confidence:* UNKNOWN — needs verification

---

## Known Issues

| Issue | Area | Status | Workaround | Discovered |
|-------|------|--------|------------|------------|
| <!-- Description --> | <!-- Module --> | OPEN | FIXED | WORKAROUND | <!-- Date --> |

*Last Updated:* {today}
*Confidence:* FACT

---

## Technical Debt

| Area | Description | Impact | Planned Fix | Priority |
|------|-------------|--------|-------------|----------|
| <!-- Module --> | <!-- What needs improvement --> | <!-- Why it matters --> | <!-- How to fix --> | HIGH | MEDIUM | LOW |

*Last Updated:* {today}
*Confidence:* FACT

---

## Discovered Assumptions

<!-- Business rules, invariants, implicit constraints that are not obvious from the code. -->

| Assumption | Source | Confidence | Last Verified |
|------------|--------|------------|---------------|
| <!-- Rule --> | <!-- Where discovered --> | FACT | INFERENCE | UNKNOWN | <!-- Date --> |

*Last Updated:* {today}

---

## Things Already Explored

<!-- Approaches tried and rejected, with reasoning. Prevents repeated investigation. -->

| Approach | Area | Tried | Result | Why Rejected |
|----------|------|-------|--------|--------------|
| <!-- Name --> | <!-- Module --> | <!-- Date --> | <!-- What happened --> | <!-- Reasoning --> |

*Last Updated:* {today}
*Confidence:* FACT

---

## Things Intentionally Not Explored

<!-- Deliberate skips with documented rationale. Different from "explored" — these were consciously deferred. -->

| Skip | Area | Rationale | When Reconsidered |
|------|------|-----------|-------------------|
| <!-- What was skipped --> | <!-- Module --> | <!-- Why it was skipped --> | <!-- Trigger to revisit --> |

*Last Updated:* {today}
*Confidence:* FACT

---

## Tool Compatibility Notes

<!-- Document any tool-specific limitations or workarounds observed -->

*Last Updated:* {today}
*Confidence:* FACT

---

<!--
Maintenance Rules:
1. Update metadata (Last Updated, Confidence) on every change.
2. Code wins over memory — if code contradicts memory, update memory.
3. Append new entries, do not delete old ones unless they are confirmed wrong.
4. Tag stale entries (>30 days without verification) as UNKNOWN.
5. Cross-reference with .ai/decisions.md for architectural decisions.
-->
"""

DECISIONS_MD = """# Architectural Decisions Log (ADR)

Append-only. Never delete entries — mark superseded instead.

---

## ADR Template

### YYYY-MM-DD: [Short Decision Title]

**Decision:** [What was decided]

**Why:** [Reasoning — constraints, trade-offs, evidence]

**Alternatives Considered:**
1. [Alternative 1] — [Why rejected]
2. [Alternative 2] — [Why rejected]

**Status:** ACTIVE | SUPERSEDED by [later ADR date/title]

**Consequences:** [Follow-on impacts, migration needs, risks]

---

*Append new entries above this line. Never delete — mark SUPERSEDED instead.*
"""

HANDOFF_MD = """# Session Handoff

The next AI session must be able to continue using only this file plus `.ai/`.

---

## Current Project State

Project scaffold created. Awaiting initial configuration.

## Completed Work

- Project scaffold created with CLAUDE.md + .ai/ directory

## Current Task

None (scaffold complete).

## Next Recommended Task

Configure project-specific conventions in .ai/memory.md. Document initial architecture in .ai/architecture.md.

## Known Risks

- No project-specific knowledge recorded yet.

## Verification

- [ ] All .ai/ files present
- [ ] docs/ directory created
"""

SESSION_MD = """# Session State

**Overwritten at end of every session by the active agent before declaring done.**

---

## Current Session

**Date:** {today}
**Agent:** Bootstrap
**Objective:** Project scaffold created.

**Blocker:** None

**What changed today:**
- Created CLAUDE.md + .ai/ directory
- Created docs/ directory

**What's next:**
- Configure .ai/memory.md with project-specific conventions
- Document architecture in .ai/architecture.md

---

*This file is explicitly disposable. If out of date, that's fine — it gets overwritten next session.*
"""

TASKS_MD = """# Cross-Session Tasks

<!-- Track tasks that span multiple sessions. Each entry tracks one active task. -->

## Active Tasks

None yet.

## Completed Tasks

- Project bootstrap ({today})
"""

GITIGNORE_LINES = """# AI Workspace OS — ephemeral session state
.ai/session.md
.ai/tasks.md
"""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def parse_stack(stack_str: str) -> tuple[str, str, str]:
    """Parse a tech stack string into frontend, backend, database components."""
    frontend = "<!-- Framework -->"
    backend = "<!-- Framework -->"
    database = "<!-- Technology -->"

    if not stack_str or stack_str == "TBD":
        return frontend, backend, database

    parts = [p.strip() for p in stack_str.replace("，", ",").split(",") if p.strip()]

    # Simple heuristic: common frontend/backend/db keywords
    frontend_keywords = {"react", "vue", "angular", "svelte", "next", "nuxt",
                         "swiftui", "uikit", "flutter", "webpack", "tailwind",
                         "html", "css", "typescript", "javascript"}
    backend_keywords = {"node", "express", "django", "flask", "fastapi", "rails",
                        "spring", "go", "rust", "python", "ruby", "java", "c#",
                        "asp.net", "graphql", "trpc", "grpc"}
    db_keywords = {"postgresql", "postgres", "mysql", "sqlite", "mongodb",
                   "redis", "dynamodb", "cassandra", "supabase", "firebase",
                   "prisma", "typeorm", "drizzle"}

    for part in parts:
        lower = part.lower()
        if any(kw in lower for kw in db_keywords):
            database = part
        elif any(kw in lower for kw in backend_keywords):
            backend = part
        elif any(kw in lower for kw in frontend_keywords):
            frontend = part
        else:
            # Unclassified: put in backend by default
            if backend == "<!-- Framework -->":
                backend = part

    return frontend, backend, database


def prompt(prompt_text: str, default: Optional[str] = None) -> str:
    """Prompt user for input with optional default."""
    if default:
        prompt_text = f"{prompt_text} [{default}]: "
    else:
        prompt_text = f"{prompt_text}: "

    try:
        value = input(prompt_text).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(1)

    if not value and default:
        return default
    return value or ""


def green(text: str) -> str:
    return f"\033[32m{text}\033[0m" if sys.stdout.isatty() else text


def yellow(text: str) -> str:
    return f"\033[33m{text}\033[0m" if sys.stdout.isatty() else text


def blue(text: str) -> str:
    return f"\033[34m{text}\033[0m" if sys.stdout.isatty() else text


def dim(text: str) -> str:
    return f"\033[2m{text}\033[0m" if sys.stdout.isatty() else text


# ─── Main ────────────────────────────────────────────────────────────────────

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Bootstrap a CLAUDE.md + .ai/ directory for any project.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s                                          # Interactive mode\n"
            "  %(prog)s --target ~/projects/my-app                # Specify target\n"
            "  %(prog)s --name MyApp --desc \"An iOS app\"          # Skip name prompts\n"
            "  %(prog)s --name MyApp --non-interactive             # Use defaults for rest\n"
            "  %(prog)s --dry-run                                 # Preview only\n"
        ),
    )
    parser.add_argument(
        "--target", type=str, default=".",
        help="Target directory to create the project scaffold in (default: current dir)",
    )
    parser.add_argument(
        "--name", type=str, default=None,
        help="Project name",
    )
    parser.add_argument(
        "--desc", type=str, default=None,
        help="One-line project description",
    )
    parser.add_argument(
        "--stack", type=str, default=None,
        help='Tech stack (e.g. "React, Node.js, PostgreSQL")',
    )
    parser.add_argument(
        "--priority", type=str, default=None,
        help="Current development priority (default: 'Initial project setup')",
    )
    parser.add_argument(
        "--non-interactive", action="store_true",
        help="Skip prompts, use defaults for missing values",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be created without writing files",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    # Resolve target directory
    target = Path(args.target).expanduser().resolve()
    today = date.today().strftime("%Y-%m-%d")

    print()
    print("┌──────────────────────────────────────────────┐")
    print("│  AI Workspace OS — Project Bootstrap         │")
    print("└──────────────────────────────────────────────┘")
    print()

    # ── Gather inputs ────────────────────────────────────────────────────────

    if args.non_interactive:
        name = args.name or "My Project"
        description = args.desc or "A new project"
        stack = args.stack or "TBD"
        priority = args.priority or "Initial project setup"
    else:
        print(blue("Let's set up your project."))
        print(dim("Press Enter to accept defaults shown in brackets.\n"))

        name = args.name or prompt("Project name", "My Project")
        description = args.desc or prompt("Description", "A new project")
        stack = args.stack or prompt(
            "Tech stack (comma-separated)", "React, Node.js, PostgreSQL"
        )
        priority = args.priority or prompt(
            "Current priority", "Initial project setup"
        )
        print()

    # Parse tech stack
    frontend, backend, database = parse_stack(stack)

    # ── Build file map ────────────────────────────────────────────────────────

    # Resolve CLAUDE.md source
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent
    claude_source = project_root / "CLAUDE.md"

    if not claude_source.exists():
        print(f"❌ Source CLAUDE.md not found at {claude_source}")
        return 1

    files_to_create: list[tuple[Path, str, str]] = [
        # (relative_path, description, content_generator)
    ]

    # CLAUDE.md — copy from source
    claude_content = claude_source.read_text(encoding="utf-8")
    files_to_create.append((
        target / "CLAUDE.md",
        "Behavior rules for AI tools",
        claude_content,
    ))

    # .ai/context.md
    files_to_create.append((
        target / ".ai" / "context.md",
        "Project context with name, stack, priorities",
        CONTEXT_MD.format(
            name=name,
            description=description,
            stack=stack if stack != "TBD" else "<!-- Add your tech stack -->",
            priority=priority,
        ),
    ))

    # .ai/architecture.md
    files_to_create.append((
        target / ".ai" / "architecture.md",
        "Architecture overview with tech stack table",
        ARCHITECTURE_MD.format(
            frontend=frontend,
            backend=backend,
            database=database,
        ),
    ))

    # .ai/memory.md
    files_to_create.append((
        target / ".ai" / "memory.md",
        "Persistent project knowledge template (16 sections)",
        MEMORY_MD.format(
            name=name,
            description=description,
            today=today,
        ),
    ))

    # .ai/decisions.md
    files_to_create.append((
        target / ".ai" / "decisions.md",
        "Architectural Decision Record (append-only)",
        DECISIONS_MD,
    ))

    # .ai/handoff.md
    files_to_create.append((
        target / ".ai" / "handoff.md",
        "Session handoff record",
        HANDOFF_MD,
    ))

    # .ai/session.md
    files_to_create.append((
        target / ".ai" / "session.md",
        "Active session state (gitignored)",
        SESSION_MD.format(today=today),
    ))

    # .ai/tasks.md
    files_to_create.append((
        target / ".ai" / "tasks.md",
        "Cross-session task tracking (gitignored)",
        TASKS_MD.format(today=today),
    ))

    # docs/ — just create the directory, no files
    docs_dir = target / "docs"

    # .gitignore handling
    gitignore_path = target / ".gitignore"
    gitignore_lines = GITIGNORE_LINES.strip()

    # ── Preview or write ─────────────────────────────────────────────────────

    print()
    print(f"  Target: {green(str(target))}")
    print(f"  Project: {green(name)}")
    print(f"  Stack: {green(stack)}")
    print()

    if args.dry_run:
        print(yellow("  DRY RUN — no files will be written"))
        print()
        print("  Files to create:")
        for path, desc, _ in files_to_create:
            try:
                rel = path.relative_to(target)
            except ValueError:
                rel = path.name
            print(f"    📄 {rel}  {dim(f'— {desc}')}")
        print(f"    📁 docs/  {dim('— Active task documentation')}")
        print()

        # Check .gitignore
        if gitignore_path.exists():
            content = gitignore_path.read_text(encoding="utf-8")
            has_session = ".ai/session.md" in content
            has_tasks = ".ai/tasks.md" in content
            if has_session and has_tasks:
                print(f"  {dim('.gitignore already has .ai/ entries')}")
            else:
                missing = []
                if not has_session: missing.append(".ai/session.md")
                if not has_tasks: missing.append(".ai/tasks.md")
                print(f"  {yellow('Would add to .gitignore:')} {', '.join(missing)}")
        else:
            print(f"  {yellow('Would create .gitignore with .ai/ entries')}")
        print()
        print(f"  {green('Ready!')} Run without {dim('--dry-run')} to write files.")
        return 0

    # ── Write files ─────────────────────────────────────────────────────────

    created = []
    skipped = []

    for path, desc, content in files_to_create:
        if path.exists():
            skipped.append((path, desc))
            continue

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        created.append((path, desc))

    # Create docs directory
    docs_dir.mkdir(parents=True, exist_ok=True)

    # ── .gitignore ────────────────────────────────────────────────────────────

    if gitignore_path.exists():
        existing = gitignore_path.read_text(encoding="utf-8")
        new_entries = []
        for line in [".ai/session.md", ".ai/tasks.md"]:
            if line not in existing:
                new_entries.append(line)

        if new_entries:
            with gitignore_path.open("a", encoding="utf-8") as f:
                f.write("\n# AI Workspace OS — ephemeral session state\n")
                for entry in new_entries:
                    f.write(entry + "\n")
            print(f"  {yellow('📝')} Updated {dim('.gitignore')} with {', '.join(new_entries)}")
        else:
            print(f"  {dim('.gitignore already has .ai/ entries')}")
    else:
        gitignore_path.write_text(gitignore_lines + "\n", encoding="utf-8")
        print(f"  {green('📝')} Created {dim('.gitignore')} with .ai/ entries")

    # ── Report ────────────────────────────────────────────────────────────────

    print()
    if created:
        print(f"  {green('✨')} Files created in {green(str(target))}:")
        for path, desc in created:
            rel = path.relative_to(target)
            print(f"    {green('✓')} {rel}  {dim(f'— {desc}')}")
        print(f"    {green('✓')} docs/  {dim('— Active task documentation')}")
    else:
        print(f"  {yellow('⚠️ ')} All files already exist — nothing created.")

    if skipped:
        print()
        print(f"  {yellow('⚠️ ')} Skipped (already exist):")
        for path, desc in skipped:
            rel = path.relative_to(target)
            print(f"    {rel}")
        print(f"  {dim('Use --dry-run to preview, or delete existing files first.')}")

    print()
    print(f"  {green('✅')} Project scaffold ready!")
    print()
    print(f"  {dim('Next steps:')}")
    print(f"   1. Review {dim('.ai/context.md')} and fill in links")
    print(f"   2. Review {dim('.ai/architecture.md')} and add your architecture")
    print(f"   3. Start developing! AI agents will auto-populate {dim('.ai/memory.md')}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
