const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const srv = http.createServer(app);

// Ajoute ces options CORS :
const io = new Server(srv, {
  cors: {
    origin: [
      // liste des origines autorisées
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // tu peux aussi mettre '*' pour autoriser toutes les origines
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
