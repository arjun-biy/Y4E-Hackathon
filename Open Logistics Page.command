#!/bin/bash
# Double-click this file to open the logistics page on http://localhost:8000
cd "$(dirname "$0")/logistics-hero"
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Serving the logistics page at http://localhost:$PORT"
echo "Keep this window open while you look at the page. Close it to stop."
( sleep 1; open "http://localhost:$PORT/index.html" ) &
python3 -m http.server $PORT
