# one-time load cell calibration, run it on the pi with the platform empty.
# a full 500 ml water bottle is ~520 g if you don't have a known weight.
# paste the number it prints into SCALE_REFERENCE_UNIT in config.py
from hx711 import HX711

import config

hx = HX711(config.HX711_DATA_PIN, config.HX711_CLOCK_PIN)
hx.set_reading_format("MSB", "MSB")
hx.set_reference_unit(1)
hx.reset()
print("Taring... keep the platform empty.")
hx.tare()

known = float(input("Place a known weight on the platform. How many grams is it? "))
raw = hx.get_weight(15)
reference_unit = raw / known
print(f"\nYour SCALE_REFERENCE_UNIT is: {reference_unit:.2f}")
print("Paste this into config.py.")
