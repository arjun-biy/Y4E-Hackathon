# kitchen dashboard:  streamlit run dashboard.py
import altair as alt
import pandas as pd
import streamlit as st

import db
from suggestions import item_waste_table, make_suggestions

st.set_page_config(page_title="Cafeteria Food Waste", layout="wide")
st.title("Cafeteria food waste")
st.caption("Tracks food, not students. No names or IDs are collected.")

conn = db.connect()
trays = pd.read_sql_query("SELECT * FROM trays", conn)

if trays.empty:
    st.info("No trays yet. Run `python seed_data.py` for sample data, or `python station.py` to log trays.")
    st.stop()

items = item_waste_table(conn)
votes = pd.read_sql_query("SELECT reason FROM votes", conn)

# Headline numbers
total_kg = items["wasted_grams"].sum() / 1000
served_kg = items["served_grams"].sum() / 1000
days = trays["served_date"].nunique()
c1, c2, c3, c4 = st.columns(4)
c1.metric("Trays tracked", f"{len(trays):,}")
c2.metric("Food thrown away", f"{total_kg:,.0f} kg")
c3.metric("Share of food wasted", f"{total_kg / served_kg:.0%}")
c4.metric("Average per tray", f"{trays['total_leftover_grams'].mean():.0f} g")

st.divider()
left, right = st.columns([3, 2])

with left:
    st.subheader("Which foods get wasted most")
    chart_df = items.assign(waste_pct=items["waste_pct"] * 100)
    chart_df["Level"] = pd.cut(
        chart_df["waste_pct"], bins=[-1, 20, 35, 101], labels=["Low", "Medium", "High"]
    )
    bars = (
        alt.Chart(chart_df)
        .mark_bar()
        .encode(
            x=alt.X("waste_pct:Q", title="% of servings thrown away"),
            y=alt.Y("item:N", sort="-x", title=None),
            color=alt.Color(
                "Level:N",
                scale=alt.Scale(domain=["Low", "Medium", "High"], range=["#9FE1CB", "#EF9F27", "#D85A30"]),
            ),
            tooltip=[
                alt.Tooltip("item:N", title="Food"),
                alt.Tooltip("waste_pct:Q", title="% wasted", format=".0f"),
                alt.Tooltip("servings:Q", title="Servings", format=","),
            ],
        )
        .properties(height=380)
    )
    st.altair_chart(bars, use_container_width=True)

with right:
    st.subheader("Why students left food")
    if votes.empty:
        st.write("No votes yet.")
    else:
        counts = votes["reason"].value_counts().reset_index()
        counts.columns = ["Reason", "Votes"]
        vote_chart = (
            alt.Chart(counts)
            .mark_bar(color="#7F77DD")
            .encode(x=alt.X("Votes:Q"), y=alt.Y("Reason:N", sort="-x", title=None), tooltip=["Reason", "Votes"])
            .properties(height=200)
        )
        st.altair_chart(vote_chart, use_container_width=True)
        st.caption(f"{len(votes):,} votes from the buttons at the tray return")

st.subheader("Food wasted per day")
daily = (
    trays.groupby("served_date")["total_leftover_grams"].sum().div(1000).reset_index(name="kg")
)
daily["served_date"] = pd.to_datetime(daily["served_date"])
day_chart = (
    alt.Chart(daily)
    .mark_line(point=True, color="#185FA5")
    .encode(
        x=alt.X("served_date:T", title=None),
        y=alt.Y("kg:Q", title="kg thrown away"),
        tooltip=[alt.Tooltip("served_date:T", title="Date"), alt.Tooltip("kg:Q", format=".1f")],
    )
    .properties(height=260)
)
st.altair_chart(day_chart, use_container_width=True)

st.divider()
st.subheader("Suggestions for the kitchen")
tips = make_suggestions(conn)
if not tips:
    st.success("Nothing is being wasted much. Nice work!")
for tip in tips:
    box = st.error if tip["level"] == "High" else st.warning
    box(
        f"**{tip['item']}**: {tip['waste_pct']}% thrown away ({tip['kg_wasted']} kg). "
        f"Top complaint: {tip['top_complaint']}.\n\n{tip['suggestion']}"
    )

with st.expander("Recent trays"):
    st.dataframe(
        trays.sort_values("id", ascending=False).head(50)[["id", "timestamp", "total_leftover_grams"]],
        use_container_width=True,
        hide_index=True,
    )
