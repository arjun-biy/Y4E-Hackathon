# Cafeteria Food Waste Station

A tray-return station that weighs leftover food, uses AI to recognize which foods were left, and shows cafeteria staff a dashboard with suggestions. It tracks food, not students: no names or IDs are ever stored.

## Try it on a laptop (no hardware needed)

You need Python 3.10 or newer.

```bash
pip install -r requirements.txt
python seed_data.py --reset      # makes 4 weeks of pretend lunch data
streamlit run dashboard.py       # opens the dashboard in your browser
```

To see the station in action (in a second terminal):

```bash
python station.py                # press Enter to drop off a pretend tray
python station.py --trays 20     # or auto-run 20 pretend trays
```

Refresh the dashboard to see new trays appear.

## What each file does

| File | What it does |
|---|---|
| `station.py` | The main program: waits for a tray, weighs it, takes a photo, figures out the leftovers, saves it, asks for a vote |
| `scale.py` | Reads the weight (real load cell or pretend scale) |
| `camera.py` | Takes the photo (Pi camera or USB webcam) |
| `recognizer.py` | Works out how much of each food is left (pretend mode, or real AI with Claude) |
| `votes.py` | The optional student vote (buttons on the Pi, keyboard on a laptop) |
| `db.py` | Saves everything in a small local database file |
| `suggestions.py` | Turns the data into tips for the kitchen |
| `dashboard.py` | The staff dashboard (charts and suggestions) |
| `seed_data.py` | Makes pretend data for demos |
| `calibrate_scale.py` | One-time scale setup on the Raspberry Pi |
| `menu.json` | The weekly menu and serving sizes. Edit this to match your school |
| `config.py` | Settings: pins, modes, thresholds |

## Using real AI food recognition

1. Get an Anthropic API key and set it:
   `export ANTHROPIC_API_KEY=your-key-here`
2. Run with: `RECOGNIZER=claude STATION_MODE=hardware python station.py`

The AI looks at the tray photo and estimates how much of each menu item is left. The station then adjusts those guesses so they match what the scale actually measured.

## Running on the Raspberry Pi

1. Wire the load cell to the HX711 board, and the HX711 to the Pi:
   - HX711 VCC to Pi 3.3V (pin 1), GND to GND (pin 6)
   - HX711 DT (data) to GPIO 5 (pin 29)
   - HX711 SCK (clock) to GPIO 6 (pin 31)
2. Connect the camera (Pi camera ribbon cable, or a USB webcam).
3. Optional vote buttons: one leg of each button to a GPIO pin, the other to GND:
   - GPIO 17 = Too much food, GPIO 27 = Didn't like it, GPIO 22 = Too cold, GPIO 23 = Loved it
4. Install the extra libraries: `pip install hx711` (and `opencv-python` if using a USB webcam).
5. Calibrate the scale once: `python calibrate_scale.py`, then paste the number into `config.py`.
6. Weigh one empty tray and put that number in `menu.json` as `empty_tray_grams`.
7. Run: `STATION_MODE=hardware RECOGNIZER=claude python station.py`

## How the waste is calculated

- Each menu item has a standard serving size in `menu.json`.
- Leftover grams for an item = serving size x fraction left on the tray.
- Waste % for an item = total grams thrown away / total grams served.
- Items over 35% are flagged "High," and over 20% "Medium."

## Ideas to add next

- A small screen at the station that shows students live results ("Today we saved 3 kg!")
- Class or grade-level competitions for least waste
- Tracking how much food goes to the share table, donation or compost
