#!/usr/bin/env bash
# scripts/release.sh — bump the version, tag it, and push to start a release.
#
# Pushing a vX.Y.Z tag triggers .github/workflows/release.yml, which builds the
# macOS / Windows / Linux / Arch packages and publishes them to GitHub Releases.
#
# Usage:
#   npm run release -- <patch|minor|major|X.Y.Z> [--dry-run] [--yes]
#
#   --dry-run   run all checks and show what would happen, change nothing
#   --yes       skip the confirmation prompt

set -euo pipefail

usage() {
  sed -n '7,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

die() {
  echo "error: $*" >&2
  exit 1
}

BUMP=""
DRY_RUN=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes | -y) ASSUME_YES=true ;;
    -h | --help) usage ;;
    -*) die "unknown option: $arg" ;;
    *) [ -z "$BUMP" ] || die "only one version argument allowed"; BUMP="$arg" ;;
  esac
done
[ -n "$BUMP" ] || usage

cd "$(git rev-parse --show-toplevel)"

# --- Work out the new version ---

CURRENT=$(node -p "require('./package.json').version")
NEW=$(node -e '
  const [cur, bump] = process.argv.slice(1)
  const [major, minor, patch] = cur.split(".").map(Number)
  const next = { major: `${major + 1}.0.0`, minor: `${major}.${minor + 1}.0`, patch: `${major}.${minor}.${patch + 1}` }[bump]
  if (next) console.log(next)
  else if (/^\d+\.\d+\.\d+$/.test(bump)) console.log(bump)
  else process.exit(1)
' "$CURRENT" "$BUMP") || die "version must be patch, minor, major, or X.Y.Z (got \"$BUMP\")"
TAG="v$NEW"

[ "$NEW" != "$CURRENT" ] || die "package.json is already at $CURRENT"

# --- Safety checks ---

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] || die "releases are cut from main (you're on '$BRANCH'). Run: git checkout main"

[ -z "$(git status --porcelain --untracked-files=no)" ] ||
  die "you have uncommitted changes — commit or stash them first"

echo "Fetching origin..."
git fetch --quiet --tags origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  if git merge-base --is-ancestor HEAD origin/main; then
    die "main is behind origin/main — run: git pull"
  else
    die "main has commits not on origin/main — push or reconcile them first"
  fi
fi

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  die "tag $TAG already exists"
fi

echo "Type-checking..."
npm run --silent typecheck

# --- Confirm ---

echo
echo "  Current version:  $CURRENT"
echo "  New version:      $NEW"
echo "  Will run:         npm version $NEW   (commit + tag $TAG)"
echo "                    git push --atomic origin main $TAG"
echo

if $DRY_RUN; then
  echo "Dry run — nothing was changed."
  exit 0
fi

if ! $ASSUME_YES; then
  read -r -p "Publish release $TAG? This is public. [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "aborted"
fi

# --- Release ---

npm version "$NEW" -m "Bump version to %s"

# --atomic: main and the tag land together or not at all
git push --atomic origin main "$TAG"

echo
echo "Pushed $TAG — the release build is running."
REPO_URL=$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##')
echo "  Actions:  $REPO_URL/actions"
echo "  Release:  $REPO_URL/releases/tag/$TAG"
if command -v gh >/dev/null; then
  echo "  Watch:    gh run watch \$(gh run list --workflow=release.yml -L1 --json databaseId -q '.[0].databaseId')"
fi
