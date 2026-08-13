#!/bin/sh
# Starts the pokepack hub and opens it in a browser.
#
# Nothing to install first except Node.js -- pokepack has no dependencies of its
# own, so there is no "npm install" step to forget.
#
# The cd is not decoration.  The hub looks for the packs folder relative to
# wherever it was started from, so this has to run in the folder it lives in and
# not in whatever folder you happened to be in.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "pokepack needs Node.js, and this machine does not have it."
  echo "  Install it from https://nodejs.org -- take the LTS download -- then run this again."
  exit 1
fi

major=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null)
case "$major" in
  '' | *[!0-9]*)
    echo "Node.js is installed but would not run."
    echo "  Reinstalling it from https://nodejs.org usually sorts it."
    exit 1
    ;;
esac
if [ "$major" -lt 18 ]; then
  echo "pokepack needs Node.js 18 or newer, and this machine has version $major."
  echo "  Update it from https://nodejs.org and run this again."
  exit 1
fi

exec node bin/pokepack.js ui "$@"
