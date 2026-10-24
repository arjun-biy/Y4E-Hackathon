# station settings, tweak for your setup
import json
import os
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "food_waste.db"
PHOTO_DIR = BASE_DIR / "photos"
MENU_PATH = BASE_DIR / "menu.json"

# "simulate" works on any laptop with no hardware.
# "hardware" uses the real scale, camera and buttons on a Raspberry Pi.
MODE = os.environ.get("STATION_MODE", "simulate")

# "mock" makes up results (no internet), "photo" reads the tray photo (needs ANTHROPIC_API_KEY)
RECOGNIZER = os.environ.get("RECOGNIZER", "mock")
VISION_MODEL = os.environ.get("VISION_MODEL", "claude-haiku-5-5")

# Scale wiring on the Raspberry Pi (BCM pin numbers) and calibration.
HX711_DATA_PIN = 5
HX711_CLOCK_PIN = 6
# Run calibrate_scale.py once and paste the number it prints here.
SCALE_REFERENCE_UNIT = float(os.environ.get("SCALE_REFERENCE_UNIT", "420.0"))

# A tray counts as "placed" once the scale reads more than this.
TRAY_DETECT_GRAMS = 200
# How many steady readings in a row before we take the photo.
STABLE_READINGS = 5
STABLE_TOLERANCE_GRAMS = 10

# Vote buttons (BCM pins) -> what each button means.
VOTE_BUTTONS = {
    17: "Too much food",
    27: "Didn't like it",
    22: "Too cold",
    23: "Loved it",
}
VOTE_TIMEOUT_SECONDS = 8


def load_menu():
    with open(MENU_PATH) as f:
        return json.load(f)


def todays_items(day=None):  # day defaults to today
    menu = load_menu()
    day = day or date.today()
    return menu["weekly_menu"][day.strftime("%A")]
