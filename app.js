// Configuration Bluetooth
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const TEXT_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const DEVICE_STORAGE_KEY = "pairedDevices";

// Éléments UI
const textInput = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");
const scanBtn = document.getElementById("scan-btn");
const devicesList = document.getElementById("devices-list");
const transferStatus = document.getElementById("transfer-status");
const confirmationPopup = document.getElementById("confirmation-popup");
const senderNameEl = document.getElementById("sender-name");
const previewTextEl = document.getElementById("preview-text");
const acceptBtn = document.getElementById("accept-btn");
const rejectBtn = document.getElementById("reject-btn");
const bluetoothStatusText = document.getElementById("bluetooth-status-text");
const connectionStatus = document.getElementById("connection-status");

// Variables globales
let connectedDevice = null;
let isReceiverMode = false;
let selectedDevice = null;
let textCharacteristic = null;

// Vérifier la disponibilité de Web Bluetooth
function checkBluetoothAvailability() {
  if (!navigator.bluetooth) {
    updateStatus("Web Bluetooth non supporté sur ce navigateur", "error");
    bluetoothStatusText.textContent = "Non supporté";
    document.querySelector(".bluetooth-icon").classList.add("off");
    return false;
  }
  return true;
}

// Mettre à jour le statut de transfert
function updateStatus(message, type = "") {
  transferStatus.textContent = message;
  transferStatus.className = "transfer-status";
  if (type) transferStatus.classList.add(type);
}

// Sauvegarder un appareil appairé
function saveDevice(device) {
  const savedDevices =
    JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY)) || [];
  if (!savedDevices.some((d) => d.id === device.id)) {
    savedDevices.push({ id: device.id, name: device.name });
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(savedDevices));
  }
}

// Charger les appareils appairés
function loadPairedDevices() {
  const savedDevices =
    JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY)) || [];
  return savedDevices;
}

// Afficher les appareils disponibles
function displayDevices(devices) {
  devicesList.innerHTML = "";

  if (devices.length === 0) {
    devicesList.innerHTML =
      '<li class="device-item">Aucun appareil trouvé</li>';
    return;
  }

  devices.forEach((device) => {
    const li = document.createElement("li");
    li.className = "device-item";

    li.innerHTML = `
            <div class="device-icon">${
              device.type === "phone" ? "📱" : "💻"
            }</div>
            <div class="device-info">
                <div class="device-name">${
                  device.name || "Appareil inconnu"
                }</div>
                <div class="device-status">Non connecté</div>
            </div>
        `;

    li.addEventListener("click", () => {
      document.querySelectorAll(".device-item").forEach((item) => {
        item.classList.remove("active");
      });
      li.classList.add("active");
      selectedDevice = device;
      updateStatus(`Sélectionné: ${device.name}`);
    });

    devicesList.appendChild(li);
  });
}

// Scanner les appareils Bluetooth
// Nouvelle fonction scanBluetoothDevices
async function scanBluetoothDevices() {
  try {
    // Vérifier la disponibilité Bluetooth
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth non supporté");
    }

    // Vérifier si Bluetooth est activé
    const availability = await navigator.bluetooth.getAvailability();
    if (!availability) {
      throw new Error("Bluetooth désactivé sur l'appareil");
    }

    updateStatus("Recherche des appareils...");

    // Ajout d'options de compatibilité
    const options = {
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
      deviceFoundTimeout: 10000, // 10 secondes max
    };

    // Ajout de gestion d'erreur spécifique
    const device = await navigator.bluetooth
      .requestDevice(options)
      .catch((err) => {
        if (err.name === "NotFoundError") {
          throw new Error("Aucun appareil Bluetooth trouvé à proximité");
        }
        throw err;
      });

    // Nouveau: Vérification de la connexion
    if (!device.gatt.connected) {
      updateStatus("Connexion en cours...");
      await device.gatt.connect();
    }

    // Mise à jour UI
    displayDevices([
      {
        id: device.id,
        name: device.name || "Appareil Bluetooth",
        type: "computer",
      },
    ]);

    updateStatus("Appareil trouvé!");
  } catch (error) {
    console.error("Erreur scan:", error);
    updateStatus(`❌ ${error.message}`, "error");

    // Nouveau: Suggestions selon l'erreur
    if (error.message.includes("Bluetooth désactivé")) {
      updateStatus("Activez Bluetooth dans les paramètres", "error");
    } else if (error.message.includes("non supporté")) {
      updateStatus("Utilisez Chrome/Edge sur Android", "error");
    }
  }
}

// Initialiser le mode récepteur
async function initReceiver() {
  try {
    isReceiverMode = true;
    updateStatus("Mode récepteur activé - En attente de texte...");

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    textCharacteristic = await service.getCharacteristic(
      TEXT_CHARACTERISTIC_UUID
    );

    await textCharacteristic.startNotifications();
    textCharacteristic.addEventListener(
      "characteristicvaluechanged",
      handleIncomingText
    );

    connectionStatus.textContent = `Connecté à: ${device.name}`;
  } catch (error) {
    console.error("Erreur mode récepteur:", error);
    updateStatus(`Erreur: ${error.message}`, "error");
  }
}

// Gérer le texte entrant
function handleIncomingText(event) {
  const value = new TextDecoder().decode(event.target.value);
  const data = JSON.parse(value);

  // Afficher la popup de confirmation
  senderNameEl.textContent = data.sender;
  previewTextEl.textContent = data.text;
  confirmationPopup.classList.add("active");
}

// Envoyer du texte
async function sendText() {
  if (!selectedDevice) {
    updateStatus("Veuillez sélectionner un appareil", "error");
    return;
  }

  const text = textInput.value.trim();
  if (!text) {
    updateStatus("Veuillez entrer du texte à envoyer", "error");
    return;
  }

  try {
    updateStatus("Connexion à l'appareil...");

    // Se connecter à l'appareil sélectionné
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: selectedDevice.name }],
      optionalServices: [SERVICE_UUID],
    });

    updateStatus("Connexion établie, envoi en cours...");

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const characteristic = await service.getCharacteristic(
      TEXT_CHARACTERISTIC_UUID
    );

    // Préparer les données à envoyer
    const data = {
      sender: `${
        device.name || "Utilisateur"
      } (${new Date().toLocaleTimeString()})`,
      text: text,
    };

    // Envoyer les données
    await characteristic.writeValue(
      new TextEncoder().encode(JSON.stringify(data))
    );

    updateStatus("✅ Texte envoyé avec succès!", "success");
    saveDevice(device);
  } catch (error) {
    console.error("Erreur envoi:", error);
    updateStatus(`❌ Échec de l'envoi: ${error.message}`, "error");
  }
}

// Accepter le transfert
async function acceptTransfer() {
  try {
    // Accepter le transfert
    await textCharacteristic.writeValue(
      new TextEncoder().encode(JSON.stringify({ status: "accepted" }))
    );
    confirmationPopup.classList.remove("active");
    updateStatus("✅ Transfert accepté! Texte reçu.");

    // Copier le texte dans le presse-papiers
    navigator.clipboard.writeText(previewTextEl.textContent);
  } catch (error) {
    console.error("Erreur acceptation:", error);
    updateStatus("❌ Erreur lors de l'acceptation", "error");
  }
}

// Refuser le transfert
async function rejectTransfer() {
  try {
    // Refuser le transfert
    await textCharacteristic.writeValue(
      new TextEncoder().encode(JSON.stringify({ status: "rejected" }))
    );
    confirmationPopup.classList.remove("active");
    updateStatus("Transfert refusé");
  } catch (error) {
    console.error("Erreur refus:", error);
    updateStatus("❌ Erreur lors du refus", "error");
  }
}

// Détection de la sélection de texte
function setupTextSelectionListener() {
  document.addEventListener("mouseup", () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 20) {
      // Seulement pour les textes significatifs
      textInput.value = selectedText;
      updateStatus("Texte sélectionné détecté! Prêt à envoyer.");
    }
  });
}

// Initialisation
function init() {
  if (checkBluetoothAvailability()) {
    // Charger les appareils déjà appairés
    const pairedDevices = loadPairedDevices();
    if (pairedDevices.length > 0) {
      displayDevices(pairedDevices);
      updateStatus("Appareils appairés chargés");
    }

    // Vérifier si nous sommes en mode récepteur
    if (window.location.hash === "#receiver") {
      initReceiver();
    }

    // Configurer les écouteurs d'événements
    scanBtn.addEventListener("click", scanBluetoothDevices);
    sendBtn.addEventListener("click", sendText);
    acceptBtn.addEventListener("click", acceptTransfer);
    rejectBtn.addEventListener("click", rejectTransfer);
    setupTextSelectionListener();
  }
}

// Démarrer l'application
window.addEventListener("load", init);
