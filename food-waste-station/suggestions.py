# rules of thumb that turn the waste numbers into tips for the kitchen
import pandas as pd

VEGETABLES = {"Steamed broccoli", "Green salad", "Corn", "Carrot sticks"}
FRUIT = {"Apple", "Orange slices"}
DRINKS = {"Milk"}

HIGH_WASTE = 0.35    # more than 35% of the item thrown away
MEDIUM_WASTE = 0.20


def item_waste_table(conn):
    df = pd.read_sql_query(
        """SELECT item,
                  COUNT(*) AS servings,
                  SUM(served_grams) AS served_grams,
                  SUM(wasted_grams) AS wasted_grams
           FROM leftovers GROUP BY item""",
        conn,
    )
    if df.empty:
        return df
    df["waste_pct"] = df["wasted_grams"] / df["served_grams"]
    return df.sort_values("waste_pct", ascending=False).reset_index(drop=True)


# top complaint on trays where this item was mostly left over
def vote_reasons_by_item(conn):
    df = pd.read_sql_query(
        """SELECT DISTINCT l.item, v.reason, v.id
           FROM votes v JOIN trays t ON t.id = v.tray_id
           JOIN leftovers l ON l.tray_id = t.id AND l.fraction_left > 0.3""",
        conn,
    )
    if df.empty:
        return {}
    df = df[df["reason"] != "Loved it"]
    top = df.groupby(["item", "reason"]).size().reset_index(name="n")
    top = top.sort_values("n", ascending=False).drop_duplicates("item")
    return dict(zip(top["item"], top["reason"]))


def make_suggestions(conn):
    table = item_waste_table(conn)
    if table.empty:
        return []
    reasons = vote_reasons_by_item(conn)
    tips = []

    for _, row in table.iterrows():
        item, pct = row["item"], row["waste_pct"]
        if pct < MEDIUM_WASTE:
            continue
        level = "High" if pct >= HIGH_WASTE else "Medium"
        reason = reasons.get(item)
        kg_total = row["wasted_grams"] / 1000

        if item in DRINKS:
            action = "Let students choose whether to take milk instead of putting it on every tray."
        elif item in FRUIT:
            action = f"Put a share table near the trash so uneaten {item.lower()} can go to another student."
        elif reason == "Too much food":
            action = f"Serve a smaller portion of {item.lower()} and let students ask for seconds."
        elif reason == "Too cold":
            action = f"Check the serving temperature of {item.lower()}; students say it's too cold."
        elif item in VEGETABLES:
            action = f"Try a smaller side of {item.lower()} with seasoning or a dip, plus a 'more please' option."
        elif reason == "Didn't like it":
            action = f"Students don't like the {item.lower()}. Try a new recipe or run a taste test."
        else:
            action = f"Cook less {item.lower()} or test a different recipe."

        tips.append(
            {
                "level": level,
                "item": item,
                "waste_pct": round(pct * 100),
                "kg_wasted": round(kg_total, 1),
                "top_complaint": reason or "-",
                "suggestion": action,
            }
        )
    return tips
