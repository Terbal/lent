const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const cors = require("cors");

// <<< activer CORS pour ton domaine front et pour Replit
app.use(
  cors({
    origin: [
      "https://terbal.github.io",
      "https://7f8d6503-1d7c-4b14-bc0e-43be76ebb244-00-n62bm2qrxeis.worf.replit.dev",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const srv = http.createServer(app);
// Ajoute ces options CORS :
const io = new Server(srv, {
  cors: {
    origin: [
      "https://terbal.github.io", // ta PWA
      "https://7f8d6503-1d7c-4b14-bc0e-43be76ebb244-00-n62bm2qrxeis.worf.replit.dev/",
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connecté", socket.id);

  socket.on("register", ({ id, username }) => {
    socket.username = username;
    // émettre la liste à tous
    const users = Array.from(io.sockets.sockets.values()).map((s) => ({
      id: s.id,
      username: s.username || "Anonyme",
    }));
    io.emit("userList", users);
  });

  socket.on("sendText", ({ to, sender, text }) => {
    io.to(to).emit("receiveText", { sender, text, date: Date.now() });
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté", socket.id);
    // mettre à jour la liste
    const users = Array.from(io.sockets.sockets.values()).map((s) => ({
      id: s.id,
      username: s.username || "Anonyme",
    }));
    io.emit("userList", users);
  });
});

srv.listen(3000, () => console.log("Socket.io sur port 3000"));
