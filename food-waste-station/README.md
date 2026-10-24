# Tray Return Tracker: Raspberry Pi station

The hardware version of Tray Return Tracker. It sits at the tray return, weighs each tray with a load cell, takes a photo, works out which foods were left, and gives the kitchen a dashboard with suggestions. It tracks food, not students, so no names or IDs are saved.

## Try it on a laptop first

No hardware needed. You need Python 3.10 or newer.

```bash
pip install -r requirements.txt
python seed_data.py --reset      # fills in 4 weeks of sample lunches
streamlit run dashboard.py       # opens the dashboard in your browser
```

Then, in a second terminal, run the station:

```bash
python station.py                # press Enter to drop off a pretend tray
python station.py --trays 20     # or run 20 pretend trays automatically
```

Refresh the dashboard to see the new trays.

## Files

| File | What it does |
|---|---|
| `station.py` | Main loop: waits for a tray, weighs it, takes a photo, works out the leftovers, saves it, asks for a vote |
| `scale.py` | Reads the weight from the load cell, or a pretend scale on a laptop |
| `camera.py` | Takes the photo with a Pi camera or USB webcam |
| `recognizer.py` | Works out how much of each food is left, either from the photo or with made-up demo results |
| `votes.py` | The optional student vote: buttons on the Pi, keyboard on a laptop |
| `db.py` | Saves everything to a small local database file |
| `suggestions.py` | Turns the numbers into tips for the kitchen |
| `dashboard.py` | Staff dashboard with charts and suggestions |
| `seed_data.py` | Makes sample data for demos |
| `calibrate_scale.py` | One-time scale setup on the Pi |
| `menu.json` | Weekly menu and serving sizes. Edit it to match your school. |
| `config.py` | Pins, modes and thresholds |

## Photo recognition

By default the station makes up realistic results. To have it read the actual tray photo:

1. Get an Anthropic API key and set it: `export ANTHROPIC_API_KEY=your-key-here`
2. Run with `RECOGNIZER=photo`, for example `RECOGNIZER=photo STATION_MODE=hardware python station.py`

It estimates how much of each menu item is left in the photo, then adjusts those numbers to match what the scale actually weighed.

## Setting up the Raspberry Pi

1. Wire the load cell to the HX711 board, and the HX711 to the Pi:
   - VCC to 3.3V (pin 1), GND to GND (pin 6)
   - DT (data) to GPIO 5 (pin 29)
   - SCK (clock) to GPIO 6 (pin 31)
2. Connect the camera (Pi camera ribbon cable or a USB webcam).
3. Optional vote buttons: one leg of each button to a GPIO pin, the other leg to GND.
   - GPIO 17 = Too much food, GPIO 27 = Didn't like it, GPIO 22 = Too cold, GPIO 23 = Loved it
4. Install the extra libraries: `pip install hx711`, plus `opencv-python` if you're using a USB webcam.
5. Calibrate the scale once with `python calibrate_scale.py`, then paste the number it prints into `config.py`.
6. Weigh one empty tray and put that number in `menu.json` as `empty_tray_grams`.
7. Run it: `STATION_MODE=hardware RECOGNIZER=photo python station.py`

## How waste is calculated

- Each menu item has a standard serving size in `menu.json`.
- Grams left of an item = serving size × fraction left on the tray.
- Waste % for an item = total grams thrown away ÷ total grams served.
- Items over 35% are flagged **High**, and items over 20% are flagged **Medium**.

## Ideas for later

- A small screen at the station that shows live results, like "Today we saved 3 kg!"
- Class or grade competitions for the least waste
- Tracking how much food goes to the share table, donations or compost
