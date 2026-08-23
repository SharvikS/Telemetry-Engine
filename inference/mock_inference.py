import time
import math
import random
from datetime import datetime, timezone
import socketio

RELAY_URL = 'http://localhost:4000'
sio = socketio.Client()

@sio.event
def connect():
    print(f"Connected to relay at {RELAY_URL}")
    sio.emit("system_info", {
        "python_version": "3.10.x (Mock)",
        "opencv_version": "4.x (Mock)",
        "capture_resolution": "1920x1080"
    })

@sio.event
def disconnect():
    print("Disconnected from relay")

def run_mock():
    print("Starting mock inference engine...")
    while not sio.connected:
        try:
            sio.connect(RELAY_URL)
        except Exception as e:
            print("Waiting for relay...")
            time.sleep(2)

    frame_count = 0
    base_health = 100.0
    last_health = 100.0
    last_game_state = "PLAYING"
    
    print("Beginning simulation loop. Press Ctrl+C to stop.")
    try:
        while True:
            t = time.time()
            
            # Simulate a loading screen every 30 seconds for 5 seconds
            in_loading_screen = (t % 30) < 5
            
            if in_loading_screen:
                game_state = "LOADING"
                brightness = random.uniform(2.0, 10.0)
                fps = random.uniform(10.0, 30.0)
            else:
                game_state = "PLAYING"
                brightness = 50.0 + math.sin(t * 0.5) * 20.0
                fps = 60.0 + random.uniform(-2.0, 2.0)
                
                # Slowly regenerate health if not full
                if base_health < 100.0:
                    base_health = min(100.0, base_health + 0.1)
                
                # Random damage spikes
                if random.random() < 0.05: # 5% chance per frame
                    damage = random.uniform(5.0, 20.0)
                    base_health = max(0.0, base_health - damage)
                    
            # Calculate mock values
            health = base_health
            stamina = 50.0 + math.sin(t * 2.0) * 50.0
            mana = 50.0 + math.cos(t * 1.5) * 50.0
            
            payload = {
                "health": round(health, 2),
                "stamina": round(stamina, 2),
                "mana": round(mana, 2),
                "fps": round(fps, 2),
                "frame_count": frame_count,
                "resolution": {"width": 1920, "height": 1080},
                "brightness": round(brightness, 2),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            if sio.connected:
                sio.emit('telemetry_update', payload)
                
                # Emit damage event
                if base_health < last_health:
                    damage_amt = last_health - base_health
                    if damage_amt >= 2.0:
                        sio.emit('damage_taken', {'amount': round(damage_amt, 2), 'timestamp': payload['timestamp']})
                
                # Emit state event
                if game_state != last_game_state:
                    sio.emit('game_state_update', {'state': game_state, 'timestamp': payload['timestamp']})
                    
                last_health = base_health
                last_game_state = game_state
                
            frame_count += 1
            time.sleep(1/60.0)
            
    except KeyboardInterrupt:
        print("Stopping mock...")
        sio.disconnect()

if __name__ == '__main__':
    run_mock()
