const http = require("http");
const { Server } = require("socket.io");

// ANSI color codes for colorful console logging
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const PORT = process.env.PORT || 4000;

// Track connected clients
let connectedClients = 0;

// Create HTTP server for REST endpoints alongside Socket.IO
const server = http.createServer((req, res) => {
  // Set CORS headers for REST requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/")) {
    const healthResponse = {
      status: "ok",
      uptime: process.uptime(),
      connectedClients: connectedClients,
      timestamp: Date.now(),
    };

    console.log(
      `${colors.cyan}🩺 [HTTP /health]${colors.reset} ${colors.gray}Status: 200 | Uptime: ${healthResponse.uptime.toFixed(1)}s | Clients: ${healthResponse.connectedClients}${colors.reset}`
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(healthResponse));
    return;
  }

  // Handle root or unknown HTTP routes
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "Telemetry Relay Server",
        status: "running",
        endpoints: {
          health: "/health",
          socketIO: "/socket.io/",
        },
        connectedClients: connectedClients,
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

// Attach Socket.IO to HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  connectedClients++;
  console.log(
    `${colors.green}🔌 [CLIENT CONNECTED]${colors.reset} ID: ${colors.bold}${socket.id}${colors.reset} ${colors.dim}(Total connected: ${connectedClients})${colors.reset}`
  );

  // Broadcast updated client count to all clients
  io.emit("client_count", {
    count: connectedClients,
    timestamp: Date.now(),
  });

  // 1. Full telemetry update event
  socket.on("telemetry_update", (data) => {
    // Inject server-side timestamp
    const payload = typeof data === "object" && data !== null ? { ...data } : { data };
    payload.server_timestamp = Date.now();

    // Broadcast full telemetry payload to all frontend clients
    io.emit("telemetry_update", payload);

    const frameStr = payload.frame_count !== undefined ? `#${payload.frame_count}` : "N/A";
    const fpsStr = payload.fps !== undefined ? `${typeof payload.fps === "number" ? payload.fps.toFixed(1) : payload.fps} FPS` : "N/A";
    const healthStr = payload.health !== undefined ? `${typeof payload.health === "number" ? payload.health.toFixed(1) : payload.health}%` : "N/A";
    const staminaStr = payload.stamina !== undefined ? `${typeof payload.stamina === "number" ? payload.stamina.toFixed(1) : payload.stamina}%` : "N/A";

    console.log(
      `${colors.magenta}📊 [TELEMETRY]${colors.reset} Frame: ${colors.cyan}${frameStr}${colors.reset} | ${colors.yellow}${fpsStr}${colors.reset} | Health: ${colors.green}${healthStr}${colors.reset} | Stamina: ${colors.blue}${staminaStr}${colors.reset}`
    );
  });

  // 2. Legacy health_update event for backwards compatibility
  socket.on("health_update", (data) => {
    // Inject server-side timestamp
    const payload = typeof data === "object" && data !== null ? { ...data } : { health: data };
    payload.server_timestamp = Date.now();

    // Broadcast the metric to all connected front-end clients
    io.emit("health_update", payload);

    const healthVal = payload.health !== undefined ? payload.health : JSON.stringify(payload);
    console.log(
      `${colors.red}❤️  [HEALTH UPDATE]${colors.reset} Health: ${colors.bold}${healthVal}${colors.reset}`
    );
  });

  // 3. System info event from inference engine
  socket.on("system_info", (data) => {
    const payload = typeof data === "object" && data !== null ? { ...data } : { data };
    payload.server_timestamp = Date.now();

    // Broadcast system info metadata to all frontend clients
    io.emit("system_info", payload);

    console.log(
      `${colors.blue}⚙️  [SYSTEM INFO]${colors.reset} Python: ${colors.cyan}${payload.python_version || "N/A"}${colors.reset} | OpenCV: ${colors.cyan}${payload.opencv_version || "N/A"}${colors.reset} | Res: ${colors.yellow}${JSON.stringify(payload.capture_resolution) || "N/A"}${colors.reset}`
    );
  });

  // Handle client disconnect
  socket.on("disconnect", (reason) => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(
      `${colors.yellow}❌ [CLIENT DISCONNECTED]${colors.reset} ID: ${colors.bold}${socket.id}${colors.reset} (${reason}) ${colors.dim}(Total connected: ${connectedClients})${colors.reset}`
    );

    // Broadcast updated client count to remaining clients
    io.emit("client_count", {
      count: connectedClients,
      timestamp: Date.now(),
    });
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`\n${colors.bold}${colors.green}🚀 [SERVER STARTED]${colors.reset} Node Relay listening on port ${colors.cyan}${PORT}${colors.reset}`);
  console.log(`${colors.gray}   Health check: http://localhost:${PORT}/health${colors.reset}`);
  console.log(`${colors.gray}   Socket.IO endpoint ready for telemetry and frontend clients${colors.reset}\n`);
});
