# top-down tray photo. returns the file path, or None when simulating
from datetime import datetime

import config


def take_photo():
    if config.MODE != "hardware":
        return None

    config.PHOTO_DIR.mkdir(exist_ok=True)
    path = config.PHOTO_DIR / f"tray_{datetime.now():%Y%m%d_%H%M%S}.jpg"

    try:
        # pi camera module (comes with raspberry pi os)
        from picamera2 import Picamera2

        cam = Picamera2()
        cam.configure(cam.create_still_configuration())
        cam.start()
        cam.capture_file(str(path))
        cam.stop()
        cam.close()
    except ImportError:
        # no picamera2 -> try a usb webcam (pip install opencv-python)
        import cv2

        cap = cv2.VideoCapture(0)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            raise RuntimeError("Could not read from the webcam.")
        cv2.imwrite(str(path), frame)

    return str(path)
