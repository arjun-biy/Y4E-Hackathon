# Y4E Hackathon

Everything for the hackathon lives here: Documents > Y4E Hackathon.

## Open the app (no typing)

Double-click **Open Food Waste App.command**. A Terminal window opens and the start page opens in your browser at http://localhost:8100. Click **Open the app** for the station and dashboard. Keep the Terminal window open while you use it.

First time only: if macOS says the file is from an "unidentified developer," right-click it, choose **Open**, then click **Open** again.

Always use the launcher. The start page's animations and the camera only work on localhost, not when you double-click an HTML file.

## Open it in VS Code

Open this folder in VS Code (File > Open Folder). Press **Cmd+Shift+B** to run the **Start food waste app** task. It starts the server and opens the app in your browser. Press the trash can in the terminal panel to stop it.

On a fresh copy from GitHub, the task and the launcher run `npm install` first to get anime.js (needs Node).

## What's in here

| Item | What it is |
|---|---|
| `food-waste-app/` | **The website.** `index.html` + `start.css` + `start.js` = start page. `app.html` + `app.css` + `app.js` = the app. anime.js lives in `node_modules` (listed in `package.json`) |
| `food-waste-station/` | Python code for the real Raspberry Pi hardware (scale, camera, buttons) |
| `design-system/` | The app's design rules made with UI UX Pro Max, plus `food-icons.blend` (food pictures) and `start-page-scenes.blend` (start page tray, bin and scale) |
| `food-waste-app/img/` | The 13 food pictures, and `img/start/` for the start page scenes. To add a picture for a new food, save a PNG named like `veggie-wrap.png` |
| `.claude/skills/ui-ux-pro-max/` | The UI UX Pro Max skill, so Claude Code picks it up in this folder (not uploaded to GitHub) |
| `logistics-hero/` + `Open Logistics Page.command` | The freight train page |
| `_old/` | Older versions, safe to delete (not uploaded to GitHub) |

## Using the app

- **Station**: pick the day, hold the tray in front of the MacBook camera, press **Scan tray**, then tap a vote. **Lunch rush** adds 50 made-up trays at once.
- **Camera**: press **Turn on camera** to use the MacBook camera in the tray box. After each scan it stays on as a small live preview in the corner, so you can scan the next tray right away. The first time, allow camera access in the browser (and in System Settings > Privacy & Security > Camera if macOS asks). Or press **Use a photo** to pick a picture of a real tray (works on a phone too).
- **Real scale**: put the tray on any kitchen scale and type the number into **Real scale reading** before you press Scan. The app adjusts the AI's guesses so they add up to that weight, the same way the Pi code does.
- **Real scans (Gemini)**: get a free key at https://aistudio.google.com/apikey, then paste it in **Settings > Gemini API key**. Now **Scan tray** turns on the camera, takes a photo, and Gemini says how much of each food is left. If no tray is in the photo, nothing is saved. The key stays in your browser, never in the code, so it's safe to push to GitHub.
- **Demo mode** (in Settings) makes up results with no camera or key. **Lunch rush** and the sample data are always made up.
- **Dashboard**: charts, filters (7 days, 4 weeks, All), suggestions for the kitchen, and **Export CSV**.
- **Menu**: change what's served each day and the serving sizes.
- Data is saved in your browser. Settings > **Reload 4 weeks of sample data** resets the demo.
