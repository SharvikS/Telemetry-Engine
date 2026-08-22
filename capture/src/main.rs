use scrap::{Capturer, Display};
use std::io::ErrorKind::WouldBlock;
use std::thread;
use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_ALL_ACCESS, MEMORY_MAPPED_VIEW_ADDRESS, PAGE_READWRITE,
};

const WIDTH: usize = 1920;
const HEIGHT: usize = 1080;
const CHANNELS: usize = 4;
const MEM_SIZE: usize = WIDTH * HEIGHT * CHANNELS;

fn main() {
    let display = Display::primary().expect("Couldn't find primary display.");
    let mut capturer = Capturer::new(display).expect("Couldn't begin capture.");
    
    // The captured width/height might differ from 1920x1080, but for MVP we assume it's fixed or we truncate/pad
    let w = capturer.width();
    let h = capturer.height();
    println!("Capturing display of size {}x{}", w, h);

    // Create a named shared memory segment on Windows
    let name: Vec<u16> = "TelemetryFrame\0".encode_utf16().collect();
    
    let handle = unsafe {
        CreateFileMappingW(
            HANDLE(0 as _), // INVALID_HANDLE_VALUE
            None,
            PAGE_READWRITE,
            0,
            MEM_SIZE as u32,
            PCWSTR(name.as_ptr()),
        )
    }.expect("Failed to create file mapping");

    let p_buf = unsafe {
        MapViewOfFile(handle, FILE_MAP_ALL_ACCESS, 0, 0, MEM_SIZE)
    };

    if p_buf.Value.is_null() {
        panic!("Failed to map view of file");
    }

    println!("Shared memory initialized. Starting capture loop...");

    loop {
        match capturer.frame() {
            Ok(frame) => {
                // frame is a &[u8] of BGRA pixels
                // Copy frame to shared memory
                let copy_size = std::cmp::min(frame.len(), MEM_SIZE);
                unsafe {
                    std::ptr::copy_nonoverlapping(frame.as_ptr(), p_buf.Value as *mut u8, copy_size);
                }
            }
            Err(ref e) if e.kind() == WouldBlock => {
                // Wait until there's a frame.
                thread::sleep(Duration::from_millis(16)); // ~60fps
                continue;
            }
            Err(_) => {
                break;
            }
        }
    }

    unsafe {
        let _ = UnmapViewOfFile(MEMORY_MAPPED_VIEW_ADDRESS { Value: p_buf.Value });
        let _ = CloseHandle(handle);
    }
}
