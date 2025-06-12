// -----------------------------
// CONFIGURATION BLE & CONSTS
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js", { scope: "/lent/" })
      .then((reg) => console.log("SW enregistré, scope:", reg.scope))
      .catch((err) => console.error("Échec SW:", err));
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

    const payload = JSON.stringify({
      sender: `${device.name || "Moi"} @ ${new Date().toLocaleTimeString()}`,
      text: txt,
    });
    await char.writeValue(new TextEncoder().encode(payload));

    updateStatus("✅ Envoyé !", "success");
    savePaired(device);
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

// -----------------------------
// SCAN DES APPAREILS
// -----------------------------
async function scanDevices() {
  if (!navigator.bluetooth) {
    return updateStatus("Web Bluetooth non supporté", "error");
  }
  try {
    updateStatus("Scan en cours…");
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    if (!device.gatt.connected) await device.gatt.connect();
    renderDevices([
      {
        id: device.id,
        name: device.name || "Bluetooth",
        type: "computer",
      },
    ]);
    updateStatus("Appareil trouvé!");
  } catch (err) {
    console.error(err);
    updateStatus(`❌ ${err.message}`, "error");
  }
}

// -----------------------------
// INITIALISATION & EVENT LISTENERS
// -----------------------------
function init() {
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
const btnEmitter = document.getElementById("btn-emitter");
const btnReceiver = document.getElementById("btn-receiver");
const modeLabel = document.getElementById("mode-label");

// SWITCH MODE
function switchMode(newMode) {
  mode = newMode;
  modeLabel.textContent = newMode === "emitter" ? "Émetteur" : "Récepteur";
  btnEmitter.classList.toggle("active", newMode === "emitter");
  btnReceiver.classList.toggle("active", newMode === "receiver");
  updateStatus(`Mode ${modeLabel.textContent} activé`);

  if (newMode === "receiver") {
    // ATTENTION : appelle initReceiver() directement depuis un click (geste utilisateur)
    initReceiver();
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
let buffer = "";
document.addEventListener("keydown", (e) => {
  buffer += e.key.toLowerCase();
  if (!secretCode.startsWith(buffer)) buffer = "";
  if (buffer === secretCode) {
    sessionStorage.setItem("allowMonitor", "yes");
    window.location.href = "/monitor.html";
  }
});
