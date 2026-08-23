"""
Telemetry Engine - Inference Layer
Zero-copy shared memory frame processor with multi-metric telemetry extraction.
Calculates rolling FPS, Health (Red), Stamina (Green), Mana (Blue), and Brightness.
Emits real-time Socket.IO events to Node.js relay.
"""

from collections import deque
from datetime import datetime, timezone
import json
import mmap
import os
import platform
import signal
import struct
import sys
import time

import cv2
import numpy as np
import socketio

# Enable ANSI escape sequences on Windows
if os.name == 'nt':
    os.system('')

# ANSI Colors for beautiful terminal output
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"

# Configuration Constants
RELAY_URL = 'http://localhost:4000'
MAX_MEM_SIZE = 3840 * 2160 * 4 + 16  # Allocate enough for 4K 60fps BGRA + Header
HEADER_SIZE = 16
MEM_TAG = "TelemetryFrame"
FPS_WINDOW_SIZE = 30
STATS_INTERVAL_SEC = 5.0

# HSV Threshold Ranges
# Red wraps around 0/180 in HSV
LOWER_RED_1 = np.array([0, 120, 70], dtype=np.uint8)
UPPER_RED_1 = np.array([10, 255, 255], dtype=np.uint8)
LOWER_RED_2 = np.array([170, 120, 70], dtype=np.uint8)
UPPER_RED_2 = np.array([180, 255, 255], dtype=np.uint8)

# Green range for stamina/energy bars [35, 120, 70] to [85, 255, 255]
LOWER_GREEN = np.array([35, 120, 70], dtype=np.uint8)
UPPER_GREEN = np.array([85, 255, 255], dtype=np.uint8)

# Blue range for mana/shield bars [100, 120, 70] to [130, 255, 255]
LOWER_BLUE = np.array([100, 120, 70], dtype=np.uint8)
UPPER_BLUE = np.array([130, 255, 255], dtype=np.uint8)

# Global State
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1)
running = True
system_info_emitted = False
current_resolution = {"width": 0, "height": 0}


def emit_system_info(width=None, height=None):
    """Emit system info payload to the relay server."""
    global system_info_emitted
    if width is not None and height is not None and width > 0 and height > 0:
        current_resolution["width"] = width
        current_resolution["height"] = height

    if not sio.connected:
        return

    res_str = (
        f"{current_resolution['width']}x{current_resolution['height']}"
        if current_resolution['width'] > 0 and current_resolution['height'] > 0
        else "unknown"
    )

    payload = {
        "python_version": platform.python_version(),
        "opencv_version": cv2.__version__,
        "capture_resolution": res_str,
    }

    try:
        sio.emit("system_info", payload)
        system_info_emitted = True
        print(f"{CYAN}[SYSTEM INFO]{RESET} Emitted system metadata: {payload}")
    except Exception as e:
        print(f"{RED}[ERROR]{RESET} Failed to emit system_info: {e}")


@sio.event
def connect():
    print(f"{GREEN}[SOCKET.IO]{RESET} Connected to Node Relay at {RELAY_URL}")
    emit_system_info()


@sio.event
def disconnect():
    print(f"{YELLOW}[SOCKET.IO]{RESET} Disconnected from Node Relay")


def connect_socketio():
    """Attempt non-blocking/interruptible connection to the Socket.IO relay."""
    while not sio.connected and running:
        try:
            sio.connect(RELAY_URL)
            break
        except Exception as e:
            print(f"{YELLOW}[SOCKET.IO]{RESET} Waiting for Node relay... ({e})")
            for _ in range(20):
                if not running:
                    return
                time.sleep(0.1)


def signal_handler(signum, frame):
    """Signal handler for graceful shutdown."""
    global running
    print(f"\n{YELLOW}[SHUTDOWN]{RESET} Termination signal received ({signum}). Initiating shutdown...")
    running = False


def cleanup(shm):
    """Clean up shared memory and socket connections."""
    print(f"{YELLOW}[CLEANUP]{RESET} Releasing resources...")
    if shm is not None:
        try:
            shm.close()
            print(f"{GREEN}[SHM]{RESET} Shared memory closed successfully.")
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} Error closing shared memory: {e}")

    if sio.connected:
        try:
            sio.disconnect()
            print(f"{GREEN}[SOCKET.IO]{RESET} Socket.IO disconnected.")
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} Error disconnecting Socket.IO: {e}")


def run_inference():
    global running, system_info_emitted
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print(f"{CYAN}{BOLD}   TELEMETRY ENGINE - INFERENCE MODULE STARTED      {RESET}")
    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print(f"{WHITE}Python Version:{RESET} {platform.python_version()}")
    print(f"{WHITE}OpenCV Version:{RESET} {cv2.__version__}")
    print(f"{WHITE}Shared Memory Tag:{RESET} {MEM_TAG}")
    print(f"{WHITE}Relay Server:{RESET} {RELAY_URL}\n")

    connect_socketio()

    shm = None
    frame_times = deque(maxlen=FPS_WINDOW_SIZE)
    last_frame_count = -1
    last_stats_time = time.time()
    last_health = None
    last_game_state = None

    try:
        while running:
            # Reconnect Socket.IO if disconnected
            if not sio.connected and running:
                connect_socketio()

            # Ensure shared memory is open
            if shm is None and running:
                try:
                    shm = mmap.mmap(-1, MAX_MEM_SIZE, tagname=MEM_TAG, access=mmap.ACCESS_READ)
                    print(f"{GREEN}[SHM]{RESET} Successfully opened shared memory: {MEM_TAG}")
                except Exception as e:
                    print(f"{YELLOW}[SHM]{RESET} Waiting for Rust capture module... ({e})")
                    for _ in range(20):
                        if not running:
                            break
                        time.sleep(0.1)
                    continue

            try:
                # Read Header (width, height, channels, frame_count)
                shm.seek(0)
                header_bytes = shm.read(HEADER_SIZE)
                if len(header_bytes) < HEADER_SIZE:
                    time.sleep(0.01)
                    continue

                width, height, channels, frame_count = struct.unpack('<IIII', header_bytes)

                # Only process if it's a new frame and valid dimensions
                if width > 0 and height > 0 and frame_count != last_frame_count:
                    last_frame_count = frame_count

                    # Check if resolution changed or needs initial system_info emission
                    if (
                        not system_info_emitted
                        or current_resolution["width"] != width
                        or current_resolution["height"] != height
                    ):
                        emit_system_info(width, height)

                    expected_size = width * height * channels
                    # Sanity check dimensions to prevent buffer overflow/crash
                    if expected_size <= (MAX_MEM_SIZE - HEADER_SIZE):
                        frame_bytes = shm.read(expected_size)

                        # Track timestamp for rolling FPS calculation
                        now = time.perf_counter()
                        frame_times.append(now)

                        if len(frame_times) >= 2:
                            fps = (len(frame_times) - 1) / (frame_times[-1] - frame_times[0])
                        else:
                            fps = 0.0

                        # Convert raw BGRA buffer to NumPy array
                        frame = np.frombuffer(frame_bytes, dtype=np.uint8).reshape((height, width, channels))

                        # Color conversion: BGRA -> BGR -> HSV
                        if channels == 4:
                            bgr = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                        else:
                            bgr = frame
                        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

                        total_pixels = width * height

                        # 1. Health Detection (Red HSV)
                        mask_red1 = cv2.inRange(hsv, LOWER_RED_1, UPPER_RED_1)
                        mask_red2 = cv2.inRange(hsv, LOWER_RED_2, UPPER_RED_2)
                        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
                        red_pixels = cv2.countNonZero(mask_red)
                        red_ratio = red_pixels / total_pixels if total_pixels > 0 else 0.0
                        health_percent = red_ratio * 100.0
                        normalized_health = min(100.0, (health_percent / 5.0) * 100.0)

                        # 2. Stamina/Energy Detection (Green HSV [35,120,70] - [85,255,255])
                        mask_green = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)
                        green_pixels = cv2.countNonZero(mask_green)
                        green_ratio = green_pixels / total_pixels if total_pixels > 0 else 0.0
                        green_percent = green_ratio * 100.0
                        normalized_stamina = min(100.0, (green_percent / 5.0) * 100.0)

                        # 3. Mana/Shield Detection (Blue HSV [100,120,70] - [130,255,255])
                        mask_blue = cv2.inRange(hsv, LOWER_BLUE, UPPER_BLUE)
                        blue_pixels = cv2.countNonZero(mask_blue)
                        blue_ratio = blue_pixels / total_pixels if total_pixels > 0 else 0.0
                        blue_percent = blue_ratio * 100.0
                        normalized_mana = min(100.0, (blue_percent / 5.0) * 100.0)

                        # 4. Average Brightness (Value Channel Mean)
                        brightness = float(cv2.mean(hsv[:, :, 2])[0])
                        
                        # Game State Detection (Loading screens are usually very dark)
                        current_game_state = "LOADING" if brightness < 15.0 else "PLAYING"

                        # ISO 8601 Timestamp
                        timestamp_iso = datetime.now(timezone.utc).isoformat()

                        # 5. Comprehensive Telemetry Payload
                        telemetry_payload = {
                            "health": round(normalized_health, 2),
                            "stamina": round(normalized_stamina, 2),
                            "mana": round(normalized_mana, 2),
                            "fps": round(fps, 2),
                            "frame_count": int(frame_count),
                            "resolution": {
                                "width": int(width),
                                "height": int(height),
                            },
                            "brightness": round(brightness, 2),
                            "red_ratio": round(red_ratio, 6),
                            "green_ratio": round(green_ratio, 6),
                            "blue_ratio": round(blue_ratio, 6),
                            "timestamp": timestamp_iso,
                        }

                        # Emit Events
                        if sio.connected:
                            try:
                                # Backward compatibility emit
                                sio.emit('health_update', {'health': round(normalized_health, 2)})
                                # Comprehensive telemetry update
                                sio.emit('telemetry_update', telemetry_payload)
                                
                                # Damage Detection
                                if last_health is not None:
                                    health_delta = normalized_health - last_health
                                    if health_delta <= -2.0:
                                        sio.emit('damage_taken', {'amount': round(abs(health_delta), 2), 'timestamp': timestamp_iso})
                                        print(f"{RED}[DAMAGE]{RESET} Took {abs(health_delta):.1f}% damage!")
                                
                                # Game State Detection
                                if current_game_state != last_game_state:
                                    sio.emit('game_state_update', {'state': current_game_state, 'timestamp': timestamp_iso})
                                    color = MAGENTA if current_game_state == "LOADING" else GREEN
                                    print(f"{color}[STATE]{RESET} Game state changed to {current_game_state}")
                                
                                last_health = normalized_health
                                last_game_state = current_game_state
                            except Exception as emit_err:
                                print(f"{RED}[ERROR]{RESET} Emit error: {emit_err}")

                        # 8. Periodic stats every 5 seconds
                        current_clock = time.time()
                        if current_clock - last_stats_time >= STATS_INTERVAL_SEC:
                            last_stats_time = current_clock
                            time_str = datetime.now().strftime("%H:%M:%S")
                            print(
                                f"{CYAN}{BOLD}[STATS {time_str}]{RESET} "
                                f"Frame: {WHITE}#{frame_count:<6}{RESET} | "
                                f"FPS: {YELLOW}{fps:>5.1f}{RESET} | "
                                f"Res: {WHITE}{width}x{height}{RESET} | "
                                f"HP: {RED}{normalized_health:>5.1f}%{RESET} | "
                                f"STA: {GREEN}{normalized_stamina:>5.1f}%{RESET} | "
                                f"MP: {BLUE}{normalized_mana:>5.1f}%{RESET} | "
                                f"Bright: {MAGENTA}{brightness:>5.1f}{RESET}"
                            )

                # Small sleep to prevent high CPU utilization when waiting for next frame
                time.sleep(0.005)

            except Exception as e:
                if running:
                    print(f"{RED}[ERROR]{RESET} Error processing frame: {e}")
                    time.sleep(1)
                    if shm is not None:
                        try:
                            shm.close()
                        except Exception:
                            pass
                        shm = None

    except KeyboardInterrupt:
        print(f"\n{YELLOW}[EXIT]{RESET} KeyboardInterrupt detected.")
    finally:
        cleanup(shm)
        print(f"{GREEN}[EXIT]{RESET} Inference engine terminated cleanly.\n")


if __name__ == '__main__':
    run_inference()
