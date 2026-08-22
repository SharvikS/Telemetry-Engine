import mmap
import time
import json
import cv2
import numpy as np
import socketio
import struct

# Allocate enough for 4K 60fps
MAX_MEM_SIZE = 3840 * 2160 * 4 + 16
HEADER_SIZE = 16
MEM_TAG = "TelemetryFrame"

sio = socketio.Client()

@sio.event
def connect():
    print("Connected to Node Relay")

@sio.event
def disconnect():
    print("Disconnected from Node Relay")

def connect_socketio():
    while not sio.connected:
        try:
            sio.connect('http://localhost:4000')
        except Exception as e:
            print(f"Waiting for Node relay... ({e})")
            time.sleep(2)

def run_inference():
    connect_socketio()

    shm = None
    while shm is None:
        try:
            shm = mmap.mmap(-1, MAX_MEM_SIZE, tagname=MEM_TAG, access=mmap.ACCESS_READ)
            print(f"Successfully opened shared memory: {MEM_TAG}")
        except Exception as e:
            print(f"Waiting for Rust capture module... ({e})")
            time.sleep(2)

    last_frame_count = -1

    while True:
        try:
            if not sio.connected:
                connect_socketio()

            # Read Header
            shm.seek(0)
            header_bytes = shm.read(HEADER_SIZE)
            width, height, channels, frame_count = struct.unpack('<IIII', header_bytes)

            # Only process if it's a new frame and valid dimensions
            if width > 0 and height > 0 and frame_count != last_frame_count:
                last_frame_count = frame_count
                
                expected_size = width * height * channels
                # Sanity check dimensions to prevent crash
                if expected_size <= (MAX_MEM_SIZE - HEADER_SIZE):
                    frame_bytes = shm.read(expected_size)
                    
                    # Convert to numpy array
                    frame = np.frombuffer(frame_bytes, dtype=np.uint8).reshape((height, width, channels))
                    
                    # Process frame
                    hsv = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                    hsv = cv2.cvtColor(hsv, cv2.COLOR_BGR2HSV)

                    lower_red1 = np.array([0, 120, 70])
                    upper_red1 = np.array([10, 255, 255])
                    lower_red2 = np.array([170, 120, 70])
                    upper_red2 = np.array([180, 255, 255])

                    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
                    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
                    mask = mask1 + mask2

                    total_pixels = width * height
                    red_pixels = cv2.countNonZero(mask)
                    health_percent = (red_pixels / total_pixels) * 100.0
                    
                    normalized_health = min(100.0, (health_percent / 5.0) * 100.0)

                    sio.emit('health_update', {'health': normalized_health})
            
            # Small sleep to prevent 100% CPU when no new frame
            time.sleep(0.01)

        except Exception as e:
            print(f"Error reading frame: {e}")
            time.sleep(1)
            # Try to re-open shared memory if it was closed
            try:
                shm = mmap.mmap(-1, MAX_MEM_SIZE, tagname=MEM_TAG, access=mmap.ACCESS_READ)
            except:
                pass

if __name__ == '__main__':
    try:
        run_inference()
    except KeyboardInterrupt:
        print("\nExiting inference...")
        if sio.connected:
            sio.disconnect()
