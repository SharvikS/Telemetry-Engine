const { Server } = require("socket.io");

const io = new Server({
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("health_update", (data) => {
    // Broadcast the metric to all connected front-end clients
    io.emit("health", data);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = 4000;
io.listen(PORT);
console.log(`Node Relay listening on port ${PORT}`);
