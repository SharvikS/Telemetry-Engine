import mmap
import time
import json
import cv2
import numpy as np
import socketio

# Shared Memory configuration
WIDTH = 1920
HEIGHT = 1080
CHANNELS = 4 # RGBA
MEM_SIZE = WIDTH * HEIGHT * CHANNELS
MEM_TAG = "TelemetryFrame"

# Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print("Connected to Node Relay")

@sio.event
def disconnect():
    print("Disconnected from Node Relay")

def run_inference():
    # Connect to the relay server
    try:
        sio.connect('http://localhost:4000')
    except Exception as e:
        print(f"Failed to connect to Node relay: {e}")
        return

    # Open the named shared memory segment on Windows
    try:
        shm = mmap.mmap(-1, MEM_SIZE, tagname=MEM_TAG, access=mmap.ACCESS_READ)
        print(f"Successfully opened shared memory: {MEM_TAG}")
    except Exception as e:
        print(f"Failed to open shared memory (make sure Rust capture is running): {e}")
        shm = None

    while True:
        if shm:
            try:
                # Read from shared memory
                shm.seek(0)
                raw_bytes = shm.read(MEM_SIZE)
                
                # Convert to numpy array
                frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((HEIGHT, WIDTH, CHANNELS))
                
                # Convert RGBA to HSV for color masking
                # In OpenCV, standard is BGR, but assuming raw bytes are RGBA or BGRA
                # Let's assume BGRA from Windows capture
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                hsv = cv2.cvtColor(hsv, cv2.COLOR_BGR2HSV)

                # Define red color range in HSV
                # Red hue wraps around 0 and 180 in OpenCV
                lower_red1 = np.array([0, 120, 70])
                upper_red1 = np.array([10, 255, 255])
                lower_red2 = np.array([170, 120, 70])
                upper_red2 = np.array([180, 255, 255])

                mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
                mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
                mask = mask1 + mask2

                # Calculate percentage of red pixels
                total_pixels = WIDTH * HEIGHT
                red_pixels = cv2.countNonZero(mask)
                health_percent = (red_pixels / total_pixels) * 100.0
                
                # For demonstration, let's normalize it to a sensible health range
                # Assuming the actual health bar covers a fraction of the screen
                # Here we'll just scale the max expected red pixels to 100%
                # Max red pixels might be around 5% of screen
                normalized_health = min(100.0, (health_percent / 5.0) * 100.0)

                # Emit the metric
                sio.emit('health_update', {'health': normalized_health})
                print(f"Emitted Health: {normalized_health:.2f}%")

            except Exception as e:
                print(f"Error during inference: {e}")
        
        # We don't sleep in shell scripts as requested, but we add a small time.sleep here
        # to avoid pegging the CPU at 100% in python
        time.sleep(0.05) 

if __name__ == '__main__':
    run_inference()
