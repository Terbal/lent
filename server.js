const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const srv = http.createServer(app);
const io = new Server(srv);

io.on("connection", (socket) => {
  console.log("Client connecté", socket.id);

  // Lorsque quelqu'un envoie un texte
  socket.on("sendText", ({ to, sender, text }) => {
    // on transmet au destinataire (si connecté)
    io.to(to).emit("receiveText", { sender, text, date: Date.now() });
  });

  // Inscription : chaque client annonce son pseudo
  socket.on("register", (username) => {
    socket.username = username;
    // on peut aussi stocker dans un dictionnaire { username: socket.id }
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté", socket.id);
  });
});

srv.listen(3000, () => console.log("Socket.io sur port 3000"));
