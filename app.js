// -----------------------------
// CONFIGURATION & INIT SOCKET
// -----------------------------
const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connecté au serveur Socket.io, id:", socket.id);
  if (username) {
    socket.emit("register", { id: socket.id, username });
  }
});

// Écoute la liste des utilisateurs
socket.on("userList", (users) => {
  renderDevices(users);
  updateStatus(`🟢 ${users.length} utilisateurs en ligne`);
});

// Quand on reçoit un message
socket.on("receiveText", ({ sender, text, date }) => {
  addRecvRecord(sender, text);
  updateStatus(`Message reçu de ${sender}`);
});

// En cas d’erreur
socket.on("connect_error", (err) => {
  console.error("Erreur socket:", err);
  updateStatus("❌ Impossible de se connecter au serveur", "error");
});

// -----------------------------
// SÉLECTEURS & VARIABLES GLOBALES
// -----------------------------
const dom = {
  inputText: document.getElementById("text-input"),
  btnSend: document.getElementById("send-btn"),
  btnScan: document.getElementById("scan-btn"),
  listDevices: document.getElementById("devices-list"),
  statusTransfer: document.getElementById("transfer-status"),
  popupConfirm: document.getElementById("confirmation-popup"),
  popupSender: document.getElementById("sender-name"),
  popupPreview: document.getElementById("preview-text"),
  btnAccept: document.getElementById("accept-btn"),
  btnReject: document.getElementById("reject-btn"),
  txtBluetoothStatus: document.getElementById("bluetooth-status-text"),
  txtConnectionStatus: document.getElementById("connection-status"),
};

let username = localStorage.getItem("username") || "";
let selectedDevice = null; // ici device = { id, username }

// -----------------------------
// UTILITAIRES
// -----------------------------
function updateStatus(msg, type = "") {
  dom.statusTransfer.textContent = msg;
  dom.statusTransfer.className = `transfer-status ${type}`;
}

function renderDevices(users) {
  dom.listDevices.innerHTML = users.length
    ? users
        .map(
          (u) => `
        <li class="device-item" data-id="${u.id}">
          <div class="device-icon">🌐</div>
          <div class="device-info">
            <div class="device-name">${u.username}</div>
            <div class="device-status">${
              u.id === socket.id ? "Vous" : "En ligne"
            }</div>
          </div>
        </li>
      `
        )
        .join("")
    : `<li class="device-item">Aucun utilisateur en ligne</li>`;

  dom.listDevices.querySelectorAll(".device-item").forEach((item) => {
    item.addEventListener("click", () => {
      dom.listDevices
        .querySelectorAll(".active")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      const id = item.dataset.id;
      const name = item.querySelector(".device-name").textContent;
      selectedDevice = { id, name };
      updateStatus(`Sélectionné: ${name}`);
    });
  });
}

// -----------------------------
// ENVOI DE TEXT via Socket.io
// -----------------------------
function sendText() {
  if (!selectedDevice) {
    return updateStatus("Sélectionnez un destinataire", "error");
  }
  const text = dom.inputText.value.trim();
  if (!text) {
    return updateStatus("Entrez du texte", "error");
  }

  socket.emit("sendText", {
    to: selectedDevice.id,
    sender: username,
    text,
  });
  updateStatus("✅ Texte envoyé");
  addSendRecord(selectedDevice.name, text);
}

// -----------------------------
// HISTORIQUES
// -----------------------------
function loadHistory(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function saveHistory(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function addSendRecord(to, text) {
  const H = loadHistory("historySend");
  H.unshift({ to, text, date: new Date().toISOString() });
  saveHistory("historySend", H);
  renderSendHistory();
}
function addRecvRecord(from, text) {
  const H = loadHistory("historyRecv");
  H.unshift({ from, text, date: new Date().toISOString() });
  saveHistory("historyRecv", H);
  renderRecvHistory();
}

function renderSendHistory() {
  const ul = document.getElementById("history-send-list");
  ul.innerHTML = loadHistory("historySend")
    .map(
      (r, i) =>
        `<li>
      <div><strong>${r.to}</strong><br><small>${new Date(
          r.date
        ).toLocaleString()}</small></div>
      <button class="delete-btn" data-i="${i}">&times;</button>
    </li>`
    )
    .join("");
  ul.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = +e.target.dataset.i;
      const H = loadHistory("historySend");
      H.splice(i, 1);
      saveHistory("historySend", H);
      renderSendHistory();
    })
  );
}

function renderRecvHistory() {
  const ul = document.getElementById("history-recv-list");
  ul.innerHTML = loadHistory("historyRecv")
    .map(
      (r, i) =>
        `<li>
      <div><strong>${r.from}</strong><br><small>${new Date(
          r.date
        ).toLocaleString()}</small></div>
      <p>${r.text}</p>
      <button class="delete-btn" data-i="${i}">&times;</button>
    </li>`
    )
    .join("");
  ul.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const i = +e.target.dataset.i;
      const H = loadHistory("historyRecv");
      H.splice(i, 1);
      saveHistory("historyRecv", H);
      renderRecvHistory();
    })
  );
}

// -----------------------------
// MODAL PSEUDO & INIT
// -----------------------------
function initUsernameModal() {
  const userModal = document.getElementById("username-modal");
  const userInput = document.getElementById("username-input");
  const userSubmit = document.getElementById("username-submit");

  if (!username) {
    userModal.classList.add("active");
    userSubmit.addEventListener("click", () => {
      const v = userInput.value.trim();
      if (v.length < 2) return alert("Pseudo trop court");
      username = v;
      localStorage.setItem("username", v);
      socket.emit("register", { id: socket.id, username });
      userModal.classList.remove("active");
    });
  }
}

// -----------------------------
// MENU MOBILE & MODE SWITCH
// -----------------------------
const hamBtn = document.getElementById("hamburger");
const mobileNav = document.getElementById("mobile-nav");
const btnEmitter = document.getElementById("btn-emitter");
const btnReceiver = document.getElementById("btn-receiver");
const modeLabel = document.getElementById("mode-label");
let mode = "emitter";

hamBtn.addEventListener("click", () => {
  hamBtn.classList.toggle("active");
  mobileNav.classList.toggle("active");
});

function switchMode(m) {
  mode = m;
  modeLabel.textContent = m === "emitter" ? "Émetteur" : "Récepteur";
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => btn.classList.toggle("active", btn.id.endsWith(m)));
  document.querySelector("#sender-history").style.display =
    m === "emitter" ? "block" : "none";
  document.querySelector("#receiver-history").style.display =
    m === "receiver" ? "block" : "none";
}
btnEmitter.addEventListener("click", () => switchMode("emitter"));
btnReceiver.addEventListener("click", () => switchMode("receiver"));

// -----------------------------
// SERVICE WORKER (PWA)
// -----------------------------
let swRegistration = null;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    swRegistration = await navigator.serviceWorker.register(
      "service-worker.js",
      { scope: "./" }
    );
  });
}

// -----------------------------
// INITIALISATION GLOBALE
// -----------------------------
window.addEventListener("load", () => {
  initUsernameModal();
  renderSendHistory();
  renderRecvHistory();

  // Bind send/scan
  dom.btnSend.addEventListener("click", sendText);
  dom.btnScan.addEventListener("click", () => {
    socket.emit("requestUserList");
  });
});
