use scrap::{Capturer, Display};
use std::io::ErrorKind::WouldBlock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_ALL_ACCESS, MEMORY_MAPPED_VIEW_ADDRESS, PAGE_READWRITE,
};

/// Shared memory segment large enough for 4K BGRA + 16-byte header.
const MAX_MEM_SIZE: usize = 3840 * 2160 * 4 + 16;
const HEADER_SIZE: usize = 16;
/// Interval between stats log lines (in seconds).
const STATS_INTERVAL_SECS: u64 = 5;

fn main() {
    println!();
    println!("  ====================================================");
    println!("   TELEMETRY ENGINE - RUST CAPTURE MODULE");
    println!("  ====================================================");
    println!();

    let display = Display::primary().expect("Couldn't find primary display.");
    let mut capturer = Capturer::new(display).expect("Couldn't begin capture.");

    let w = capturer.width();
    let h = capturer.height();
    let channels = 4; // BGRA
    let frame_bytes = w * h * channels;

    println!("  Display:        {}x{} ({}ch)", w, h, channels);
    println!("  Frame size:     {} bytes ({:.1} MB)", frame_bytes, frame_bytes as f64 / 1_048_576.0);
    println!("  Shared memory:  {} bytes ({:.1} MB)", MAX_MEM_SIZE, MAX_MEM_SIZE as f64 / 1_048_576.0);
    println!("  Memory tag:     TelemetryFrame");
    println!();

    // Create a named shared memory segment on Windows
    let name: Vec<u16> = "TelemetryFrame\0".encode_utf16().collect();

    let handle = unsafe {
        CreateFileMappingW(
            INVALID_HANDLE_VALUE,
            None,
            PAGE_READWRITE,
            0,
            MAX_MEM_SIZE as u32,
            PCWSTR(name.as_ptr()),
        )
    }.expect("Failed to create file mapping");

    let p_buf = unsafe {
        MapViewOfFile(handle, FILE_MAP_ALL_ACCESS, 0, 0, MAX_MEM_SIZE)
    };

    if p_buf.Value.is_null() {
        panic!("Failed to map view of file");
    }

    println!("  [OK] Shared memory initialized successfully.");
    println!("  [OK] Starting capture loop...\n");

    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    ctrlc::set_handler(move || {
        println!("\n  [CTRL-C] Initiating graceful shutdown...");
        r.store(false, Ordering::SeqCst);
    }).expect("Error setting Ctrl-C handler");

    let mut frame_counter: u32 = 0;
    let mut dropped_frames: u64 = 0;
    let start_time = Instant::now();
    let mut last_stats_time = Instant::now();
    let mut frames_since_last_stats: u64 = 0;
    let mut last_frame_time = Instant::now();
    let mut min_frame_us: u128 = u128::MAX;
    let mut max_frame_us: u128 = 0;

    while running.load(Ordering::SeqCst) {
        match capturer.frame() {
            Ok(frame) => {
                let now = Instant::now();
                let frame_us = now.duration_since(last_frame_time).as_micros();
                last_frame_time = now;

                if frame_counter > 0 {
                    min_frame_us = min_frame_us.min(frame_us);
                    max_frame_us = max_frame_us.max(frame_us);
                }

                let actual_data_size = w * h * channels;
                let copy_size = std::cmp::min(frame.len(), actual_data_size);

                unsafe {
                    let ptr = p_buf.Value as *mut u8;

                    // Write header (little endian): [width:4][height:4][channels:4][frame_count:4]
                    std::ptr::copy_nonoverlapping(&(w as u32).to_le_bytes()[0], ptr.add(0), 4);
                    std::ptr::copy_nonoverlapping(&(h as u32).to_le_bytes()[0], ptr.add(4), 4);
                    std::ptr::copy_nonoverlapping(&(channels as u32).to_le_bytes()[0], ptr.add(8), 4);
                    std::ptr::copy_nonoverlapping(&frame_counter.to_le_bytes()[0], ptr.add(12), 4);

                    // Write frame data directly after header
                    std::ptr::copy_nonoverlapping(frame.as_ptr(), ptr.add(HEADER_SIZE), copy_size);
                }

                frame_counter = frame_counter.wrapping_add(1);
                frames_since_last_stats += 1;

                // Periodic stats logging
                let elapsed_since_stats = last_stats_time.elapsed().as_secs();
                if elapsed_since_stats >= STATS_INTERVAL_SECS {
                    let interval_fps = frames_since_last_stats as f64 / last_stats_time.elapsed().as_secs_f64();
                    let total_elapsed = start_time.elapsed().as_secs_f64();
                    let avg_fps = frame_counter as f64 / total_elapsed;

                    println!(
                        "  [STATS] Frame #{:<8} | FPS: {:.1} (avg {:.1}) | Frame time: {:.1}ms–{:.1}ms | Dropped: {} | Uptime: {:.0}s",
                        frame_counter,
                        interval_fps,
                        avg_fps,
                        min_frame_us as f64 / 1000.0,
                        max_frame_us as f64 / 1000.0,
                        dropped_frames,
                        total_elapsed,
                    );

                    last_stats_time = Instant::now();
                    frames_since_last_stats = 0;
                    min_frame_us = u128::MAX;
                    max_frame_us = 0;
                }
            }
            Err(ref e) if e.kind() == WouldBlock => {
                // No frame ready yet, brief sleep
                thread::sleep(Duration::from_millis(1));
                continue;
            }
            Err(e) => {
                dropped_frames += 1;
                eprintln!("  [ERROR] Capture error: {:?}", e);
                if dropped_frames > 100 {
                    eprintln!("  [FATAL] Too many errors, shutting down.");
                    break;
                }
                thread::sleep(Duration::from_millis(50));
            }
        }
    }

    // Graceful cleanup
    let total_elapsed = start_time.elapsed();
    let avg_fps = frame_counter as f64 / total_elapsed.as_secs_f64();

    println!();
    println!("  ====================================================");
    println!("   SESSION SUMMARY");
    println!("  ====================================================");
    println!("  Total frames:   {}", frame_counter);
    println!("  Dropped frames: {}", dropped_frames);
    println!("  Session time:   {:.1}s", total_elapsed.as_secs_f64());
    println!("  Average FPS:    {:.1}", avg_fps);
    println!();

    unsafe {
        println!("  Unmapping shared memory and closing handles...");
        let _ = UnmapViewOfFile(MEMORY_MAPPED_VIEW_ADDRESS { Value: p_buf.Value });
        let _ = CloseHandle(handle);
    }
    println!("  Shutdown complete.\n");
}
