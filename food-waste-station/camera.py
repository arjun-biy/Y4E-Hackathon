"""Takes a photo of the tray from above."""
from datetime import datetime

import config


def take_photo():
    """Returns the saved photo path, or None in simulate mode."""
    if config.MODE != "hardware":
        return None

    config.PHOTO_DIR.mkdir(exist_ok=True)
    path = config.PHOTO_DIR / f"tray_{datetime.now():%Y%m%d_%H%M%S}.jpg"

    try:
        # Raspberry Pi Camera Module (pre-installed on Raspberry Pi OS)
        from picamera2 import Picamera2

        cam = Picamera2()
        cam.configure(cam.create_still_configuration())
        cam.start()
        cam.capture_file(str(path))
        cam.stop()
        cam.close()
    except ImportError:
        # Fallback: any USB webcam. pip install opencv-python
        import cv2

        cap = cv2.VideoCapture(0)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            raise RuntimeError("Could not read from the webcam.")
        cv2.imwrite(str(path), frame)

    return str(path)
