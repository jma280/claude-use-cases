#!/bin/bash
# Brings the game back for game night: publishes the game's database rules and the website.
# Run with:  bash go-public.sh
cd "$(dirname "$0")" || exit 1
npx firebase-tools deploy || { echo "Deploy failed. The game may still be offline."; exit 1; }
echo
echo "PUBLIC: the game is live. Run 'bash go-private.sh' when you are done."
