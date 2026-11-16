use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;
use std::sync::Arc;
use std::thread;

fn probe(ip: &str) -> Option<String> {
    let addr = format!("{}:11434", ip);
    // TCP connect
    let sock: SocketAddr = addr.parse().ok()?;
    let stream = TcpStream::connect_timeout(&sock, Duration::from_secs(3)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(8))).ok()?;
    stream.set_write_timeout(Some(Duration::from_secs(8))).ok()?;
    // HTTP GET /api/tags
    let req = format!("GET /api/tags HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n", ip);
    use std::io::{Read, Write as W};
    let mut s = stream;
    s.write_all(req.as_bytes()).ok()?;
    let mut buf = Vec::new();
    let mut tmp = [0u8; 8192];
    loop {
        match s.read(&mut tmp) {
            Ok(0) => break,
            Ok(n) => buf.extend_from_slice(&tmp[..n]),
            Err(_) => break,
        }
    }
    let text = String::from_utf8_lossy(&buf);
    // extract body after \r\n\r\n
    let body = text.split("\r\n\r\n").nth(1)?;
    // parse model names crudely
    // look for "name":"..."
    let mut names = Vec::new();
    let mut i = 0;
    while let Some(pos) = body[i..].find("\"name\"") {
        let start = i + pos;
        if let Some(colon) = body[start..].find(':') {
            let after = &body[start+colon+1..];
            // find quote
            let q1 = after.find('"')?;
            let rest = &after[q1+1..];
            if let Some(q2) = rest.find('"') {
                names.push(rest[..q2].to_string());
                i = start + colon + 1 + q1 + 1 + q2 + 1;
                continue;
            }
        }
        break;
    }
    if names.is_empty() { return None; }
    Some(format!("{}: {}", ip, names.join(", ")))
}

fn main() {
    let f = File::open("/Users/user/code/Cletus/hpc_11434_targets.txt").unwrap();
    let reader = BufReader::new(f);
    let ips: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    let out = Arc::new(std::sync::Mutex::new(File::create("/Users/user/code/Cletus/hpc_ollama_models.txt").unwrap()));
    let mut handles = Vec::new();
    let chunk = 256;
    for batch in ips.chunks(chunk) {
        let batch = batch.to_vec();
        let out = out.clone();
        let h = thread::spawn(move || {
            for ip in batch {
                if let Some(line) = probe(&ip) {
                    let mut f = out.lock().unwrap();
                    writeln!(f, "{}", line).unwrap();
                    f.flush().unwrap();
                }
            }
        });
        handles.push(h);
    }
    // limit concurrency: join in groups
    for h in handles { h.join().unwrap(); }
    println!("done");
}
