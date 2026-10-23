"""The tray-return station: weigh -> photo -> recognize leftovers -> save -> ask for a vote.

Run on a laptop (simulated):      python station.py
Auto-run 20 simulated trays:      python station.py --trays 20
Run on the Raspberry Pi:          STATION_MODE=hardware python station.py
"""
import argparse
import random
from datetime import date

import camera
import config
import db
from recognizer import get_recognizer
from scale import get_scale, wait_for_stable_tray, wait_for_tray_removed
from votes import ask_vote


def match_to_scale(fractions, served, measured_leftover_grams):
    """Nudge the AI's guesses so they add up to what the scale actually measured."""
    estimated = sum(fractions[i] * served[i] for i in fractions)
    if estimated <= 0 or measured_leftover_grams <= 0:
        return fractions
    factor = max(0.5, min(2.0, measured_leftover_grams / estimated))
    return {i: round(min(1.0, f * factor), 2) for i, f in fractions.items()}


def process_tray(conn, scale, recognizer, menu, items, served_date, auto=False):
    served = {item: menu["items"][item] for item in items}
    empty_tray = menu["empty_tray_grams"]

    if config.MODE != "hardware":
        # Pretend a student drops off a tray with some leftovers on it.
        pretend = recognizer.estimate(None, items)
        leftover = sum(pretend[i] * served[i] for i in items)
        scale.place_tray(empty_tray + leftover)

    print("Waiting for a tray...")
    weight = wait_for_stable_tray(scale, poll_seconds=0.01 if auto else 0.2)
    measured_leftover = max(0.0, weight - empty_tray)

    photo = camera.take_photo()
    if config.MODE == "hardware" or config.RECOGNIZER == "claude":
        fractions = recognizer.estimate(photo, items)
    else:
        fractions = pretend
    fractions = match_to_scale(fractions, served, measured_leftover)

    leftovers = [{"item": i, "served_grams": served[i], "fraction_left": fractions[i]} for i in items]
    tray_id = db.save_tray(conn, served_date, round(measured_leftover, 1), leftovers, photo)

    print(f"Tray #{tray_id}: {measured_leftover:.0f} g of food left")
    for row in leftovers:
        if row["fraction_left"] > 0:
            print(f"   - {row['item']}: {row['fraction_left'] * 100:.0f}% left")

    if measured_leftover > 20:
        if auto:
            reason = random.choice(list(config.VOTE_BUTTONS.values()) + [None, None, None])
        else:
            reason = ask_vote()
        if reason:
            db.save_vote(conn, served_date, reason, tray_id)
            print(f"   Vote saved: {reason}")

    if config.MODE != "hardware":
        scale.remove_tray()
    wait_for_tray_removed(scale, poll_seconds=0.01 if auto else 0.2)
    print("Thanks!\n")


def main():
    parser = argparse.ArgumentParser(description="Food waste tray-return station")
    parser.add_argument("--trays", type=int, default=0, help="Auto-run this many simulated trays, then stop")
    args = parser.parse_args()

    menu = config.load_menu()
    items = config.todays_items()
    served_date = date.today().isoformat()
    conn = db.connect()
    scale = get_scale()
    recognizer = get_recognizer()

    print(f"Food waste station ready ({config.MODE} mode, {config.RECOGNIZER} recognizer)")
    print(f"Today's menu: {', '.join(items)}\n")

    if args.trays:
        for _ in range(args.trays):
            process_tray(conn, scale, recognizer, menu, items, served_date, auto=True)
        return

    try:
        while True:
            if config.MODE != "hardware":
                input("Press Enter to drop off a pretend tray (Ctrl+C to quit)...")
            process_tray(conn, scale, recognizer, menu, items, served_date)
    except KeyboardInterrupt:
        print("\nStation stopped.")


if __name__ == "__main__":
    main()
