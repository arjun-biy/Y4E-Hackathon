"""Fills the database with 4 weeks of realistic pretend data, so the dashboard has something to show.

python seed_data.py            # adds 4 weeks of school days
python seed_data.py --reset    # deletes old data first
"""
import argparse
import random
from datetime import date, datetime, timedelta

import config
import db
from recognizer import MockRecognizer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weeks", type=int, default=4)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    if args.reset and config.DB_PATH.exists():
        config.DB_PATH.unlink()

    conn = db.connect()
    menu = config.load_menu()
    mock = MockRecognizer()
    reasons = list(config.VOTE_BUTTONS.values())

    start = date.today() - timedelta(weeks=args.weeks)
    day = start
    total = 0
    while day < date.today():
        if day.weekday() < 5:  # school days only
            items = config.todays_items(day)
            for _ in range(random.randint(150, 260)):
                fractions = mock.estimate(None, items)
                leftovers = [
                    {"item": i, "served_grams": menu["items"][i], "fraction_left": fractions[i]} for i in items
                ]
                grams = sum(r["served_grams"] * r["fraction_left"] for r in leftovers)
                ts = datetime.combine(day, datetime.min.time()) + timedelta(
                    hours=11, minutes=random.randint(30, 90), seconds=random.randint(0, 59)
                )
                tray_id = db.save_tray(conn, day.isoformat(), round(grams, 1), leftovers, timestamp=ts.isoformat())
                if grams > 20 and random.random() < 0.3:
                    worst = max(leftovers, key=lambda r: r["fraction_left"])["item"]
                    weights = [3, 3, 1, 1] if worst in {"Steamed broccoli", "Green salad", "Fish sticks"} else [3, 1, 1, 2]
                    reason = random.choices(reasons, weights=weights)[0]
                    db.save_vote(conn, day.isoformat(), reason, tray_id, timestamp=ts.isoformat())
                total += 1
        day += timedelta(days=1)

    print(f"Added {total} pretend trays to {config.DB_PATH.name}")


if __name__ == "__main__":
    main()
