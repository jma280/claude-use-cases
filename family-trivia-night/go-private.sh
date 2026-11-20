#!/bin/bash
# Takes the game offline: locks the database so nothing can read or write it,
# then stops serving the website. Run with:  bash go-private.sh
cd "$(dirname "$0")" || exit 1
echo "Locking the database..."
npx firebase-tools deploy --only database --config firebase.locked.json || { echo "Could not lock the database. Nothing else was changed."; exit 1; }
echo "Taking the website offline..."
npx firebase-tools hosting:disable --force || { echo "The database is locked, but the website is still up. Run this script again."; exit 1; }
echo
echo "PRIVATE: the database is locked and the website is offline."
