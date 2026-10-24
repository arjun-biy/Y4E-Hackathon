# optional "why did you leave food?" vote
import time

import config


# arcade buttons on the pi; gives up after VOTE_TIMEOUT_SECONDS
def ask_vote_buttons():
    from gpiozero import Button  # pre-installed on Raspberry Pi OS

    buttons = {pin: Button(pin) for pin in config.VOTE_BUTTONS}
    deadline = time.time() + config.VOTE_TIMEOUT_SECONDS
    try:
        while time.time() < deadline:
            for pin, button in buttons.items():
                if button.is_pressed:
                    return config.VOTE_BUTTONS[pin]
            time.sleep(0.05)
        return None
    finally:
        for button in buttons.values():
            button.close()


def ask_vote_kb():
    reasons = list(config.VOTE_BUTTONS.values())
    print("  Why did you leave food? (optional)")
    for i, reason in enumerate(reasons, 1):
        print(f"    {i}. {reason}")
    choice = input("  Press 1-4 then Enter, or just Enter to skip: ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(reasons):
        return reasons[int(choice) - 1]
    return None


def ask_vote():
    return ask_vote_buttons() if config.MODE == "hardware" else ask_vote_kb()
