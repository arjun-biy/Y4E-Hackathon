"""Figures out how much of each food is left on the tray.

MockRecognizer: makes realistic pretend results (no internet, good for demos).
ClaudeRecognizer: sends the photo to Claude's vision AI.
"""
import base64
import json
import random

import config

# How much of each food kids tend to leave, for the mock (0 = eats it all).
TYPICAL_LEFTOVER = {
    "Steamed broccoli": 0.55,
    "Green salad": 0.50,
    "Fish sticks": 0.40,
    "Carrot sticks": 0.35,
    "Corn": 0.25,
    "Apple": 0.30,
    "Orange slices": 0.20,
    "Milk": 0.30,
    "Spaghetti with marinara": 0.20,
    "Bean and cheese burrito": 0.25,
    "Chicken tacos": 0.12,
    "Cheese pizza": 0.08,
    "Chicken nuggets": 0.06,
}


class MockRecognizer:
    def estimate(self, photo_path, items):
        results = {}
        for item in items:
            avg = TYPICAL_LEFTOVER.get(item, 0.25)
            if random.random() < 0.45:  # many kids finish an item completely
                results[item] = 0.0
            else:
                results[item] = round(min(1.0, max(0.0, random.gauss(avg * 1.6, 0.2))), 2)
        return results


class ClaudeRecognizer:
    def __init__(self):
        # pip install anthropic, and set the ANTHROPIC_API_KEY environment variable
        import anthropic

        self.client = anthropic.Anthropic()

    def estimate(self, photo_path, items):
        with open(photo_path, "rb") as f:
            image_b64 = base64.standard_b64encode(f.read()).decode()

        prompt = (
            "This is a photo of a school lunch tray after a student finished eating. "
            f"The tray was served with: {', '.join(items)}. "
            "For each item, estimate what fraction of the original serving is left "
            "(0 = fully eaten, 1 = untouched). "
            "Reply with ONLY a JSON object mapping each item name exactly as given to a number."
        )
        message = self.client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        text = message.content[0].text.strip()
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start : end + 1])
        return {item: float(data.get(item, 0.0)) for item in items}


def get_recognizer():
    return ClaudeRecognizer() if config.RECOGNIZER == "claude" else MockRecognizer()
