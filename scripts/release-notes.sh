#!/bin/bash
# release-notes.sh prints the release notes for the people using the app: the
# "## User notes" sections of the pull requests merged into main in a range
# of commits, oldest first. They are written for users, without PR numbers or
# links, and become the GitHub release body (docs/VERSIONING.md).
#
#	scripts/release-notes.sh <last-tag-or-empty> <sha>
#	scripts/release-notes.sh -extract < pr-body.md
#
# The first form needs gh with GH_TOKEN and REPO=owner/name; the second
# prints the section of one body, for testing.
set -euo pipefail

# extract prints the "## User notes" section of a pull request body: the
# lines up to the next "## " heading, without HTML comments and outer blank
# lines. A section that says only "-" or "none" counts as empty.
extract() {
	tr -d '\r' | awk '
		/^##[ \t]/ { on = 0 }
		/^##[ \t]+User notes[ \t]*$/ { on = 1; next }
		!on { next }
		{
			out = ""
			while ($0 != "") {
				if (comment) {
					i = index($0, "-->")
					if (!i) { $0 = ""; break }
					$0 = substr($0, i + 3); comment = 0
				} else {
					i = index($0, "<!--")
					if (!i) { out = out $0; break }
					out = out substr($0, 1, i - 1); $0 = substr($0, i + 4); comment = 1
				}
			}
			sub(/[ \t]+$/, "", out)
			if (out == "" && n == 0) next
			lines[++n] = out
			if (out != "") last = n
		}
		END {
			if (last == 1 && tolower(lines[1]) ~ /^(-|none)$/) exit
			for (i = 1; i <= last; i++) print lines[i]
		}
	'
}

if [ "${1:-}" = -extract ]; then
	extract
	exit
fi

from=${1:-}
sha=$2
if [ -n "$from" ]; then
	commits=$(git rev-list --reverse "$from..$sha")
else
	commits=$sha
fi

seen=" "
notes=""
for c in $commits; do
	prs=$(gh api "repos/$REPO/commits/$c/pulls" --jq '.[] | select(.merged_at != null and .base.ref == "main") | .number')
	for pr in $prs; do
		case "$seen" in *" $pr "*) continue ;; esac
		seen="$seen$pr "
		body=$(gh api "repos/$REPO/pulls/$pr" --jq '.body // ""')
		n=$(printf '%s\n' "$body" | extract)
		[ -n "$n" ] || continue
		notes="$notes${notes:+$'\n\n'}$n"
	done
done

printf '%s\n' "${notes:-Minor improvements and fixes.}"
