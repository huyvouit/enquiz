#!/usr/bin/env bash
# Versioned releases of EnQuiz (plan 6.5, decision D21).
#
#   scripts/release.sh prepare            build + deploy WITHOUT traffic, print test URLs
#   scripts/release.sh promote            only after the owner said yes: switch traffic,
#                                         publish the preview channel, push the git tag
#   scripts/release.sh status             what production runs now
#   scripts/release.sh rollback <x.y.z>   back to an earlier release
#
# The version comes from the VERSION file at the repo root (SemVer). Real
# project values come from .env.release (gitignored; see .env.release.example).
# DRY_RUN=1 prints the cloud commands instead of running them.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
if [ -f .env.release ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.release
  set +a
fi
: "${PROJECT_ID:?Set PROJECT_ID in .env.release}"
: "${REGION:?Set REGION in .env.release}"
: "${SITE:?Set SITE in .env.release}"
SERVICE=${SERVICE:-enquiz-api}
DRY_RUN=${DRY_RUN:-}

VERSION=$(tr -d '[:space:]' < VERSION)
TAG="v$VERSION"            # git tag, e.g. v1.2.0
RTAG="v${VERSION//./-}"    # Cloud Run revision tag and Firebase channel, e.g. v1-2-0
REPO="$REGION-docker.pkg.dev/$PROJECT_ID/enquiz"
IMAGE="$REPO/api:$VERSION"
COMMIT=$(git rev-parse --short HEAD)
SITE_URL="https://$SITE.web.app"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
run() {
  if [ -n "$DRY_RUN" ]; then printf '  [dry-run] %s\n' "$*"; else "$@"; fi
}
# Prints a field of the JSON on stdin; empty when missing or not JSON (an
# older release has no version; Firebase answers a missing file with the SPA).
json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let j;try{j=JSON.parse(s||"{}")}catch{j={}}const v=process.argv[1].split(".").reduce((o,k)=>o?.[k],j);process.stdout.write(v==null?"":String(v))})' "$1"; }
service_json() { gcloud run services describe "$SERVICE" --region="$REGION" --format=json; }
tag_url() {
  service_json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=(JSON.parse(s).status.traffic||[]).find(x=>x.tag===process.argv[1]);process.stdout.write(t?.url??"")})' "$1"
}
check_version() { # url expected
  local got
  got=$(curl -fsS "$1" | json_field "$3")
  [ "$got" = "$2" ] || fail "$1 reports version '$got', expected '$2'"
  echo "  ✓ $1 → $2"
}

prepare() {
  say "Checks for $TAG (commit $COMMIT)"
  [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "VERSION '$VERSION' is not MAJOR.MINOR.PATCH"
  grep -q "^## \[$VERSION\]" CHANGELOG.md || fail "CHANGELOG.md has no '## [$VERSION]' section"
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    [ -n "$DRY_RUN" ] && echo "  ! uncommitted changes (allowed in dry run)" || fail "Uncommitted changes"
  fi
  if [ "$branch" != main ]; then
    [ -n "$DRY_RUN" ] && echo "  ! on '$branch', not main (allowed in dry run)" || fail "Release from main only (now on '$branch')"
  fi
  git fetch -q origin main --tags
  if [ -z "$DRY_RUN" ] && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    fail "main is not in sync with origin/main"
  fi
  git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && fail "Tag $TAG already exists: bump VERSION"
  echo "  ✓ VERSION, CHANGELOG, branch, tag"

  say "Backend: image $VERSION, revision tag $RTAG, no traffic"
  run gcloud builds submit be --tag "$IMAGE" --region="$REGION"
  run gcloud run deploy "$SERVICE" --image="$IMAGE" --region="$REGION" \
    --no-traffic --tag="$RTAG" \
    --update-env-vars="APP_VERSION=$VERSION,GIT_COMMIT=$COMMIT"

  local run_url api_url
  run_url=$(service_json | json_field status.url)
  if [ -n "$DRY_RUN" ]; then api_url="https://$RTAG---<service-url>"; else api_url=$(tag_url "$RTAG"); fi
  [ -n "$api_url" ] || fail "No URL for revision tag $RTAG"
  [ -n "$DRY_RUN" ] || check_version "$api_url/api/v1/health" "$VERSION" data.version

  say "Frontend: preview channel $RTAG"
  (
    cd fe
    run npm ci --no-audit --no-fund
    VITE_LIVE_URL="$run_url" VITE_SITE_URL="$SITE_URL" \
      VITE_APP_VERSION="$VERSION" VITE_GIT_COMMIT="$COMMIT" run npm run build
    run firebase hosting:channel:deploy "$RTAG" --only app --expires 30d --project "$PROJECT_ID"
  )
  local preview_url=""
  if [ -z "$DRY_RUN" ]; then
    preview_url=$(cd fe && firebase hosting:channel:list --site "$SITE" --project "$PROJECT_ID" --json \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=(JSON.parse(s).result?.channels||[]).find(x=>x.name.endsWith("/channels/"+process.argv[1]));process.stdout.write(c?.url??"")})' "$RTAG")
    [ -n "$preview_url" ] && check_version "$preview_url/version.json" "$VERSION" version
  fi

  say "Ready for the owner's confirmation"
  cat <<EOF
  Version     $TAG ($COMMIT)
  API (test)  $api_url/api/v1/health
  Site (test) ${preview_url:-<preview channel URL>}
              Its /api calls still go to the live backend until promote.
  Changes     see CHANGELOG.md, section [$VERSION]

  Production is unchanged. After the owner confirms:
    scripts/release.sh promote
EOF
}

promote() {
  say "Promote $TAG"
  if [ -z "$DRY_RUN" ]; then
    [ -n "$(tag_url "$RTAG")" ] || fail "Revision tag $RTAG not found: run prepare first"
  fi
  run gcloud run services update-traffic "$SERVICE" --region="$REGION" --to-tags="$RTAG=100"
  (cd fe && run firebase hosting:clone "$SITE:$RTAG" "$SITE:live" --project "$PROJECT_ID")
  if [ -z "$DRY_RUN" ]; then
    check_version "$SITE_URL/api/v1/health" "$VERSION" data.version
    check_version "$SITE_URL/version.json" "$VERSION" version
  fi
  run git tag -a "$TAG" -m "EnQuiz $TAG"
  run git push origin "$TAG"
  say "Released $TAG"
  echo "  Roll back with: scripts/release.sh rollback <previous version>"
}

rollback() {
  local to=${1:?Usage: scripts/release.sh rollback <x.y.z>}
  local rt="v${to//./-}"
  say "Roll back to v$to"
  run gcloud run services update-traffic "$SERVICE" --region="$REGION" --to-tags="$rt=100"
  if ! (cd fe && run firebase hosting:clone "$SITE:$rt" "$SITE:live" --project "$PROJECT_ID"); then
    echo "  ! Preview channel $rt is gone (kept 30 days): roll the site back in"
    echo "    Firebase Console → Hosting → Release history → the v$to release → Rollback"
  fi
  [ -n "$DRY_RUN" ] || check_version "$SITE_URL/api/v1/health" "$to" data.version
}

status() {
  say "Cloud Run traffic"
  service_json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const t of JSON.parse(s).status.traffic||[])console.log("  "+String(t.percent??0).padStart(3)+"%  "+(t.revisionName||"LATEST").padEnd(24)+(t.tag?" tag "+t.tag:""))})'
  say "Live"
  local api site
  api=$(curl -fsS "$SITE_URL/api/v1/health" | json_field data.version)
  site=$(curl -fsS "$SITE_URL/version.json" 2>/dev/null | json_field version)
  echo "  API  ${api:-(before versioning)}"
  echo "  Site ${site:-(before versioning)}"
  echo "  VERSION file: $VERSION"
}

case "${1:-}" in
  prepare) prepare ;;
  promote) promote ;;
  rollback) rollback "${2:-}" ;;
  status) status ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
