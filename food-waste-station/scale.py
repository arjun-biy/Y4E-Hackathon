"""Reads the weight on the tray platform.

HardwareScale: real load cell + HX711 board on a Raspberry Pi.
SimulatedScale: pretend scale for testing on any computer.
"""
import random
import time

import config


class HardwareScale:
    def __init__(self):
        # Library: pip install hx711  (works with the common HX711 boards)
        from hx711 import HX711

        self.hx = HX711(config.HX711_DATA_PIN, config.HX711_CLOCK_PIN)
        self.hx.set_reading_format("MSB", "MSB")
        self.hx.set_reference_unit(config.SCALE_REFERENCE_UNIT)
        self.hx.reset()
        print("Taring scale... keep the platform empty.")
        self.hx.tare()

    def read_grams(self):
        value = self.hx.get_weight(5)
        self.hx.power_down()
        self.hx.power_up()
        return max(0.0, float(value))


class SimulatedScale:
    """Pretends a tray is placed, sits still, then is lifted off."""

    def __init__(self):
        self._tray_weight = None
        self._ticks = 0

    def place_tray(self, grams):
        self._tray_weight = grams
        self._ticks = 0

    def read_grams(self):
        if self._tray_weight is None:
            return random.uniform(0, 3)
        self._ticks += 1
        wobble = random.uniform(-25, 25) if self._ticks < 3 else random.uniform(-2, 2)
        return self._tray_weight + wobble

    def remove_tray(self):
        self._tray_weight = None


def get_scale():
    return HardwareScale() if config.MODE == "hardware" else SimulatedScale()


def wait_for_stable_tray(scale, poll_seconds=0.2):
    """Wait until a tray is on the scale and the reading stops wobbling."""
    readings = []
    while True:
        grams = scale.read_grams()
        if grams < config.TRAY_DETECT_GRAMS:
            readings = []
        else:
            readings.append(grams)
            readings = readings[-config.STABLE_READINGS:]
            if (
                len(readings) == config.STABLE_READINGS
                and max(readings) - min(readings) <= config.STABLE_TOLERANCE_GRAMS
            ):
                return sum(readings) / len(readings)
        time.sleep(poll_seconds)


def wait_for_tray_removed(scale, poll_seconds=0.2):
    while scale.read_grams() >= config.TRAY_DETECT_GRAMS:
        time.sleep(poll_seconds)
