// -----------------------------
// CONFIGURATION BLE & CONSTS

// const { text } = require("stream/consumers");

// -----------------------------
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const TEXT_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const STORAGE_KEY_PAIRED = "pairedDevices";
const RECEIVER_HASH = "#receiver";

// Sélecteurs DOM
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

let selectedDevice = null;
let textCharacteristic = null;
let isReceiverMode = false;

// -----------------------------
// SERVICE WORKER (PWA)
// -----------------------------

let swRegistration = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      swRegistration = await navigator.serviceWorker.register(
        "service-worker.js",
        { scope: "/lent/" }
      );
      console.log("SW enregistré, scope:", swRegistration.scope);
    } catch (err) {
      console.error("Échec SW:", err);
    }
  });
}

const hamBtn = document.getElementById("hamburger");
const mobileNav = document.getElementById("mobile-nav");
hamBtn.addEventListener("click", () => {
  hamBtn.classList.toggle("active");
  mobileNav.classList.toggle("active");
});

// --- Pseudo utilisateur ---
let username = localStorage.getItem("username") || "";

// Elements
const userModal = document.getElementById("username-modal");
const userInput = document.getElementById("username-input");
const userSubmit = document.getElementById("username-submit");
// Sélecteurs Mode Émetteur/Récepteur
const btnEmitter = document.getElementById("btn-emitter");
const btnReceiver = document.getElementById("btn-receiver");
const modeLabel = document.getElementById("mode-label");

// Au chargement de la page
window.addEventListener("load", () => {
  const storedName = localStorage.getItem("username");
  if (storedName) {
    // Si on a déjà un pseudo, on le charge et on cache la modal
    username = storedName;
    if (userModal) userModal.classList.remove("active");
  } else {
    // Pas de pseudo, on affiche la modal et on bloque l'app
    if (userModal) userModal.classList.add("active");
  }
});

// Quand l’utilisateur valide son pseudo
if (userSubmit) {
  userSubmit.addEventListener("click", () => {
    const val = userInput.value.trim();
    if (val.length < 2) {
      alert("Votre pseudo doit contenir au moins 2 caractères.");
      return;
    }
    localStorage.setItem("username", val);
    username = val;
    userModal.classList.remove("active");
  });
}

// -----------------------------
// UTILS
// -----------------------------
function updateStatus(msg, type = "") {
  dom.statusTransfer.textContent = msg;
  dom.statusTransfer.className = `transfer-status ${type}`;
}

function savePaired(device) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_PAIRED)) || [];
  if (!saved.some((d) => d.id === device.id)) {
    saved.push({ id: device.id, name: device.name });
    localStorage.setItem(STORAGE_KEY_PAIRED, JSON.stringify(saved));
  }
}

function loadPaired() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_PAIRED)) || [];
}

function renderDevices(devices) {
  dom.listDevices.innerHTML = devices.length
    ? devices
        .map(
          (d) => `
        <li class="device-item" data-id="${d.id}">
          <div class="device-icon">${d.type === "phone" ? "📱" : "💻"}</div>
          <div class="device-info">
            <div class="device-name">${d.name || "Inconnu"}</div>
            <div class="device-status">Non connecté</div>
          </div>
        </li>
      `
        )
        .join("")
    : `<li class="device-item">Aucun appareil</li>`;

  dom.listDevices.querySelectorAll(".device-item").forEach((item) =>
    item.addEventListener("click", () => {
      dom.listDevices
        .querySelectorAll(".active")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      selectedDevice = devices.find((d) => d.id === item.dataset.id);
      updateStatus(`Sélectionné: ${selectedDevice.name}`);
    })
  );
}

// -----------------------------
// MODE RÉCEPTEUR
// -----------------------------
async function initReceiver() {
  isReceiverMode = true;
  updateStatus("Mode récepteur – attente…");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    textCharacteristic = await svc.getCharacteristic(TEXT_CHAR_UUID);

    await textCharacteristic.startNotifications();
    textCharacteristic.addEventListener("characteristicvaluechanged", (e) => {
      const { sender, text } = JSON.parse(
        new TextDecoder().decode(e.target.value)
      );
      dom.popupSender.textContent = sender;
      dom.popupPreview.textContent = text;
      dom.popupConfirm.classList.add("active");
    });

    dom.txtConnectionStatus.textContent = `Connecté à : ${device.name}`;
  } catch (err) {
    console.error(err);
    updateStatus(`Erreur récepteur: ${err.message}`, "error");
  }
}

// -----------------------------
// ENVOI DE TEXTE
// -----------------------------
async function sendText() {
  if (!selectedDevice) {
    return updateStatus("Sélectionnez un appareil", "error");
  }
  const txt = dom.inputText.value.trim();
  if (!txt) {
    return updateStatus("Entrez du texte", "error");
  }

  try {
    updateStatus("Connexion…");
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: selectedDevice.name }],
      optionalServices: [SERVICE_UUID],
    });
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    const char = await svc.getCharacteristic(TEXT_CHAR_UUID);

    const data = { sender: username, text };

    await char.writeValue(new TextEncoder().encode(payload));

    updateStatus("✅ Envoyé !", "success");
    savePaired(device);
    addSendRecord(targetName, text);
  } catch (err) {
    console.error(err);
    updateStatus(`❌ Échec: ${err.message}`, "error");
  }
}

// -----------------------------
// POPUP ACCEPT/REJECT
// -----------------------------
async function acceptTransfer() {
  await textCharacteristic.writeValue(
    new TextEncoder().encode(JSON.stringify({ status: "accepted" }))
  );
  dom.popupConfirm.classList.remove("active");
  updateStatus("✅ Transfert accepté");
  navigator.clipboard.writeText(dom.popupPreview.textContent);
}

async function rejectTransfer() {
  await textCharacteristic.writeValue(
    new TextEncoder().encode(JSON.stringify({ status: "rejected" }))
  );
  dom.popupConfirm.classList.remove("active");
  updateStatus("Transfert refusé");
}

// Initialisation Notification API
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

// Modal elements
const scanModal = document.getElementById("scan-modal");
const scanListEl = document.getElementById("scan-device-list");
const associateBtn = document.getElementById("associate-btn");
const scanCancelBtn = document.getElementById("scan-cancel");
let scannedDevice = null;

if (scanCancelBtn) {
  scanCancelBtn.addEventListener("click", () => {
    updateStatus("Recherche annulée", "error");
    notify("Scan annulé", "Vous avez annulé la recherche d’appareils.");
    closeScanModal();
  });
}

// Ouvre le modal
function openScanModal() {
  scanListEl.innerHTML = "";
  associateBtn.disabled = true;
  scannedDevice = null;
  scanModal.classList.add("active");
}

// Ferme le modal
function closeScanModal() {
  scanModal.classList.remove("active");
}

// Affiche une notification
function notify(title, body) {
  // Si on a bien la registration du SW, on l’utilise
  if (swRegistration) {
    swRegistration.showNotification(title, { body });
    return;
  }
  // Sinon, fallback si la permission a été accordée
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

// Quand on clique sur Annuler
scanCancelBtn.addEventListener("click", () => {
  updateStatus("Recherche annulée", "error");
  notify("Scan annulé", "Vous avez annulé la recherche d’appareils.");
  closeScanModal();
});

// -----------------------------
// SCAN DES APPAREILS
// -----------------------------
async function scanDevices() {
  if (!navigator.bluetooth) {
    return updateStatus("Bluetooth non supporté", "error");
  }

  try {
    updateStatus("✅ Démarrage de la recherche…");
    notify("Scan démarré", "Recherche d'appareils compatibles");

    // Ouvrir le modal de scan
    openScanModal();

    // Appel au chooser natif
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });

    // Si on arrive ici, un appareil a été choisi
    updateStatus(`✔ Appareil détecté : ${device.name}`);
    notify("Appareil trouvé", device.name || "Appareil sans nom");

    // Ajout dans la liste du modal
    const li = document.createElement("li");
    li.textContent = device.name || device.id;
    scanListEl.appendChild(li);

    // Cliquer sur l'élément pour le sélectionner
    li.addEventListener("click", () => {
      scanListEl
        .querySelectorAll("li")
        .forEach((el) => el.classList.remove("selected"));
      li.classList.add("selected");
      scannedDevice = device;
      associateBtn.disabled = false;
    });
  } catch (err) {
    const msg =
      err.name === "NotFoundError" || err.message.includes("User cancelled")
        ? "Aucun appareil trouvé ou recherche annulée"
        : `Erreur lors du scan : ${err.message}`;
    updateStatus(msg, "error");
    notify("Scan échoué", msg);
    console.error("scanDevices error:", err);
    // Fermer le modal
    closeScanModal();
  }
}

associateBtn.addEventListener("click", async () => {
  if (!scannedDevice) return;
  updateStatus("🔗 Connexion à " + (scannedDevice.name || scannedDevice.id));
  notify("Connexion", `Connexion à ${scannedDevice.name}`);

  try {
    const server = await scannedDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    textCharacteristic = await service.getCharacteristic(TEXT_CHAR_UUID);
    selectedDevice = scannedDevice;

    updateStatus("✅ Appareil appairé avec succès !");
    notify("Appairage réussi", scannedDevice.name || scannedDevice.id);
    savePaired(scannedDevice);
  } catch (err) {
    const msg = `Échec de la connexion : ${err.message}`;
    updateStatus(msg, "error");
    notify("Erreur de connexion", msg);
    console.error("associate error:", err);
  } finally {
    closeScanModal();
  }
});

function handleIncomingText(event) {
  const raw = new TextDecoder().decode(event.target.value);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return updateStatus("Données reçues invalides", "error");
  }
  // Affiche la popup de confirmation
  dom.popupSender.textContent = data.sender;
  dom.popupPreview.textContent = data.text;
  dom.popupConfirm.classList.add("active");

  // Enregistre dans l’historique réception
  addRecvRecord(data.sender, data.text);
}

// -----------------------------
// INITIALISATION & EVENT LISTENERS
// -----------------------------
function init() {
  let username = localStorage.getItem("username") || "";
  const userModal = document.getElementById("username-modal");
  const userInput = document.getElementById("username-input");
  const userSubmit = document.getElementById("username-submit");

  if (!username && userModal) {
    userModal.classList.add("active");
    userSubmit.addEventListener("click", () => {
      const v = userInput.value.trim();
      if (v.length < 2) return alert("Pseudo trop court");
      localStorage.setItem("username", v);
      username = v;
      userModal.classList.remove("active");
    });
  }

  // Status Bluetooth
  if (!navigator.bluetooth) {
    dom.txtBluetoothStatus.textContent = "Non supporté";
    return updateStatus("Bluetooth indisponible", "error");
  }

  // Chargement des appairés
  const paired = loadPaired();
  if (paired.length) {
    renderDevices(paired);
    updateStatus("App. appairés chargés");
  }

  // Mode récepteur si URL contient #receiver
  if (window.location.hash === RECEIVER_HASH) {
    initReceiver();
  }

  // Listeners
  dom.btnScan.addEventListener("click", scanDevices);
  dom.btnSend.addEventListener("click", sendText);
  dom.btnAccept.addEventListener("click", acceptTransfer);
  dom.btnReject.addEventListener("click", rejectTransfer);

  // Sélection de texte auto
  document.addEventListener("mouseup", () => {
    const sel = window.getSelection().toString().trim();
    if (sel.length > 20) {
      dom.inputText.value = sel;
      updateStatus("Texte détecté – prêt à envoyer");
    }
  });
}

let deferredInstallPrompt = null;

// Capter l'événement PWA installable
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // bloque la popup native
  deferredInstallPrompt = e; // conserve l'événement
  document.getElementById("install-modal").classList.add("active"); // affiche ta modal custom
});

// Référencer les boutons
const installAccept = document.getElementById("install-accept");
const installCancel = document.getElementById("install-cancel");

// Si l'utilisateur accepte
installAccept?.addEventListener("click", async () => {
  document.getElementById("install-modal").classList.remove("active");
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt(); // lance la vraie popup
  const choice = await deferredInstallPrompt.userChoice;
  console.log("PWA install choice:", choice.outcome);
  deferredInstallPrompt = null;
});

// Si l'utilisateur refuse
installCancel?.addEventListener("click", () => {
  document.getElementById("install-modal").classList.remove("active");
});

window.addEventListener("load", init);

// … en tête du fichier, on conserve SERVICE_UUID, etc.

let mode = "emitter"; // par défaut

// Sélecteurs supplémentaire
const sendSection = document.querySelector("#text-input").parentNode;
const scanSection = document.querySelector("#scan-btn").parentNode;
const recvHistorySect = document.getElementById("receiver-history");

// SWITCH MODE
function switchMode(newMode) {
  mode = newMode;
  modeLabel.textContent = newMode === "emitter" ? "Émetteur" : "Récepteur";
  btnEmitter.classList.toggle("active", newMode === "emitter");
  btnReceiver.classList.toggle("active", newMode === "receiver");
  updateStatus(`Mode ${modeLabel.textContent} activé`);

  if (newMode === "emitter") {
    sendSection.style.display = "block";
    scanSection.style.display = "block";
    recvHistorySect.style.display = "none";
  } else {
    sendSection.style.display = "none";
    scanSection.style.display = "none";
    recvHistorySect.style.display = "block";
  }
}

// Bind des boutons
btnEmitter.addEventListener("click", () => switchMode("emitter"));
btnReceiver.addEventListener("click", () => switchMode("receiver"));

// On supprime la détection au load :
// if (window.location.hash === '#receiver') initReceiver();

// Ensuite, dans tes handlers de scan/send, tu peux gate-keeper sur `mode` :

document.getElementById("send-btn").addEventListener("click", () => {
  if (mode !== "emitter") {
    return updateStatus("Pour envoyer, passez en mode Émetteur", "error");
  }
  sendText();
});

document.getElementById("scan-btn").addEventListener("click", () => {
  if (mode !== "emitter") {
    return updateStatus(
      "La recherche d'appareils n'est disponible qu'en mode Émetteur",
      "error"
    );
  }
  scanDevices();
});

// SECRET: ouverture de la page de monitoring
const secretCode = "monitor";
let inputBuffer = "";
document.addEventListener("keydown", (e) => {
  inputBuffer += e.key.toLowerCase();
  if (!secretCode.startsWith(inputBuffer)) inputBuffer = "";
  else if (inputBuffer === secretCode) {
    sessionStorage.setItem("allowMonitor", "yes");
    window.location.href = "monitor.html";
  }
});

// Stockage et affichage de l’historique

// Historique des réceptions (Récepteur)
