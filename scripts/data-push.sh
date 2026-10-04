#!/bin/sh
# Publish the baked data (apps/web/public/data) to the orphan `data` branch that CI builds Pages from.
# One commit, force-pushed: re-bakes replace it, history does not pile up.
#   pnpm data:push [remote name or url]
set -eu
remote=${1:-origin}
url=$(git remote get-url "$remote" 2>/dev/null || echo "$remote")
src=$(git rev-parse --show-toplevel)/apps/web/public/data
[ -f "$src/manifest.json" ] || { echo "no baked data in $src (run pnpm bake)" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q -b data
cp -R "$src"/. "$tmp"/
git -C "$tmp" add -A
git -C "$tmp" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" \
  commit -qm "data: bake $(git rev-parse --short HEAD)"
git -C "$tmp" push -qf "$url" data:data
echo "pushed $(du -sh "$src" | cut -f1) to $remote/data"
