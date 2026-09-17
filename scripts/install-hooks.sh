#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# install-hooks.sh — Install git hooks for the AI Workspace OS
#
# Symlinks hooks from scripts/ into .git/hooks/ so they are always in sync
# with the tracked versions.
#
# Usage:
#   ./scripts/install-hooks.sh              # Install hooks for this repo
#   ./scripts/install-hooks.sh --all        # Install hooks for this repo + all projects/
#   ./scripts/install-hooks.sh --list       # List available hooks
#   ./scripts/install-hooks.sh --uninstall  # Remove installed hooks
# ─────────────────────────────────────────────────────────────────────────────

# Note: No set -e. All functions use explicit || return / exit guards.
# set -e would abort the install for one hook failure instead of continuing.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Configuration ───────────────────────────────────────────────────────────

# List of hooks to install (source in scripts/ → target in .git/hooks/)
HOOKS="
pre-commit
"

# ─── Colors ──────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ─── Functions ───────────────────────────────────────────────────────────────

info()  { printf "${BLUE}  →${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}  ✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}  ⚠️  %s${NC}\n" "$1"; }
error() { printf "${RED}  ✗ %s${NC}\n" "$1"; }

install_hook() {
    hook_name="$1"
    git_dir="$2"
    hook_source="$SCRIPT_DIR/$hook_name"
    hook_target="$git_dir/hooks/$hook_name"

    if [ ! -f "$hook_source" ]; then
        warn "Hook source not found: $hook_source"
        return 1
    fi

    # Create hooks directory if it doesn't exist
    mkdir -p "$(dirname "$hook_target")"

    # Remove existing hook if it's a regular file (not a symlink we own)
    if [ -f "$hook_target" ] && [ ! -L "$hook_target" ]; then
        warn "Existing hook found at $hook_target (not a symlink). Backing up to ${hook_target}.bak"
        mv "$hook_target" "${hook_target}.bak"
    fi

    # Create symlink (use relative path if possible)
    hook_source_rel=$(python3 -c "
import os.path
try:
    print(os.path.relpath('$hook_source', os.path.dirname('$hook_target')))
except ValueError:
    print('$hook_source')
" 2>/dev/null || echo "$hook_source")

    ln -sf "$hook_source_rel" "$hook_target"
    chmod +x "$hook_target"

    ok "Installed $hook_name → $hook_target"
}

uninstall_hook() {
    hook_name="$1"
    git_dir="$2"
    hook_target="$git_dir/hooks/$hook_name"

    if [ -L "$hook_target" ]; then
        rm "$hook_target"
        ok "Removed symlink: $hook_target"
    elif [ -f "$hook_target" ]; then
        warn "Not a symlink: $hook_target. Remove manually."
    fi

    # Restore backup if it exists
    if [ -f "${hook_target}.bak" ]; then
        mv "${hook_target}.bak" "$hook_target"
        ok "Restored backup: ${hook_target}.bak → $hook_target"
    fi
}

install_for_repo() {
    git_dir="$1"
    repo_label="$2"

    if [ ! -d "$git_dir" ]; then
        warn "$repo_label: No .git directory at $git_dir"
        return 1
    fi

    echo ""
    info "Installing hooks for $repo_label..."

    for hook_name in $HOOKS; do
        [ -z "$hook_name" ] && continue
        install_hook "$hook_name" "$git_dir"
    done
}

uninstall_for_repo() {
    git_dir="$1"
    repo_label="$2"

    if [ ! -d "$git_dir" ]; then
        warn "$repo_label: No .git directory at $git_dir"
        return 1
    fi

    echo ""
    info "Uninstalling hooks for $repo_label..."

    for hook_name in $HOOKS; do
        [ -z "$hook_name" ] && continue
        uninstall_hook "$hook_name" "$git_dir"
    done
}

list_hooks() {
    echo ""
    info "Available hooks in $SCRIPT_DIR:"
    for hook_name in $HOOKS; do
        [ -z "$hook_name" ] && continue
        if [ -f "$SCRIPT_DIR/$hook_name" ]; then
            ok "$hook_name"
        else
            warn "$hook_name (source file missing)"
        fi
    done
}

# ─── Main ────────────────────────────────────────────────────────────────────

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  AI Workspace OS — Git Hook Installer        │"
echo "└──────────────────────────────────────────────┘"

# Parse arguments
case "${1:-}" in
    --list|-l)
        list_hooks
        exit 0
        ;;
    --uninstall|-u)
        uninstall_for_repo "$PROJECT_ROOT/.git" "workspace root"
        exit $?
        ;;
    --all|-a)
        install_for_repo "$PROJECT_ROOT/.git" "workspace root"
        # Install for all project directories
        for project_dir in "$PROJECT_ROOT"/projects/*/; do
            if [ -d "$project_dir" ]; then
                project_name=$(basename "$project_dir")
                if [ -d "$project_dir/.git" ]; then
                    install_for_repo "$project_dir/.git" "project: $project_name"
                fi
            fi
        done
        echo ""
        ok "All hooks installed."
        ;;
    --help|-h)
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  (no args)    Install hooks for this repository"
        echo "  --all, -a    Install hooks for this repo + all projects/ subdirectories"
        echo "  --list, -l   List available hooks"
        echo "  --uninstall, -u  Remove installed hooks (restore backups if any)"
        echo "  --help, -h   Show this help message"
        echo ""
        exit 0
        ;;
    *)
        install_for_repo "$PROJECT_ROOT/.git" "workspace root"
        echo ""
        ok "Hooks installed. Run '$0 --help' for more options."
        ;;
esac

exit 0
