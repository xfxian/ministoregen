#!/bin/sh
# next-version.sh prints the version a release of the given kind produces,
# based on the highest vMAJOR.MINOR.PATCH tag in this repository.
#
#	scripts/next-version.sh major|minor|patch|none
#
# With no tag yet the base is v0.0.0. For "none" it prints nothing.
#
# While the major version is 0 (before 1.0), a breaking change bumps the
# minor version: v0.3.4 + major -> v0.4.0. Leaving 0.x is a deliberate step
# taken with the Release workflow's "version" input, never a label.
set -eu

kind=${1:-}
case "$kind" in
major | minor | patch) ;;
none) exit 0 ;;
*)
	echo "usage: $0 major|minor|patch|none" >&2
	exit 2
	;;
esac

latest=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n 1 || true)
[ -n "$latest" ] || latest=v0.0.0

IFS=. read -r major minor patch <<VERSION
${latest#v}
VERSION

[ "$kind" = major ] && [ "$major" -eq 0 ] && kind=minor

case "$kind" in
major) major=$((major + 1)) minor=0 patch=0 ;;
minor) minor=$((minor + 1)) patch=0 ;;
patch) patch=$((patch + 1)) ;;
esac

echo "v$major.$minor.$patch"
