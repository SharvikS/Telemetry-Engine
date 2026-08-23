use scrap::{Capturer, Display};
use std::io::ErrorKind::WouldBlock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_ALL_ACCESS, MEMORY_MAPPED_VIEW_ADDRESS, PAGE_READWRITE,
};

// Allocate enough for 4K 60fps to be safe
const MAX_MEM_SIZE: usize = 3840 * 2160 * 4 + 16; 
const HEADER_SIZE: usize = 16;

fn main() {
    let display = Display::primary().expect("Couldn't find primary display.");
    let mut capturer = Capturer::new(display).expect("Couldn't begin capture.");
    
    let w = capturer.width();
    let h = capturer.height();
    let channels = 4; // BGRA
    println!("Capturing display of size {}x{}", w, h);

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

    println!("Shared memory initialized. Starting capture loop...");

    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    ctrlc::set_handler(move || {
        println!("\nReceived Ctrl-C, initiating graceful shutdown...");
        r.store(false, Ordering::SeqCst);
    }).expect("Error setting Ctrl-C handler");

    let mut frame_counter: u32 = 0;

    while running.load(Ordering::SeqCst) {
        match capturer.frame() {
            Ok(frame) => {
                let actual_data_size = w * h * channels;
                let copy_size = std::cmp::min(frame.len(), actual_data_size);
                
                unsafe {
                    let ptr = p_buf.Value as *mut u8;
                    
                    // Write header (little endian)
                    std::ptr::copy_nonoverlapping(&(w as u32).to_le_bytes()[0], ptr.add(0), 4);
                    std::ptr::copy_nonoverlapping(&(h as u32).to_le_bytes()[0], ptr.add(4), 4);
                    std::ptr::copy_nonoverlapping(&(channels as u32).to_le_bytes()[0], ptr.add(8), 4);
                    std::ptr::copy_nonoverlapping(&frame_counter.to_le_bytes()[0], ptr.add(12), 4);
                    
                    // Write frame data directly after header
                    std::ptr::copy_nonoverlapping(frame.as_ptr(), ptr.add(HEADER_SIZE), copy_size);
                }
                frame_counter = frame_counter.wrapping_add(1);
            }
            Err(ref e) if e.kind() == WouldBlock => {
                // Wait until there's a frame.
                thread::sleep(Duration::from_millis(16)); // ~60fps
                continue;
            }
            Err(e) => {
                println!("Capture error: {:?}", e);
                break;
            }
        }
    }

    // Graceful cleanup
    unsafe {
        println!("Unmapping memory and closing handles...");
        let _ = UnmapViewOfFile(MEMORY_MAPPED_VIEW_ADDRESS { Value: p_buf.Value });
        let _ = CloseHandle(handle);
    }
    println!("Shutdown complete.");
}
