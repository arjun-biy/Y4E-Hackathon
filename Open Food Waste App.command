#!/bin/bash
# Double-click to open the Tray Return Tracker app at http://localhost
cd "$(dirname "$0")/food-waste-app"
[ -d node_modules ] || npm install
PORT=8100
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Tray Return Tracker is running at http://localhost:$PORT"
echo "Keep this window open while you use the app. Close it to stop."
( sleep 1; open "http://localhost:$PORT/index.html" ) &
python3 server.py $PORT
