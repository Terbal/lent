// -----------------------------
// CONFIGURATION & VARIABLES
// -----------------------------
const dom = {
  inputText: document.getElementById('text-input'),
  btnSend: document.getElementById('send-btn'),
  btnScan: document.getElementById('scan-btn'),
  listDevices: document.getElementById('devices-list'),
  statusTransfer: document.getElementById('transfer-status'),
  connectionOptions: document.getElementById('connection-options'),
  directConnectBtn: document.getElementById('direct-connect-btn'),
  qrcodeModal: document.getElementById('qrcode-modal'),
  scannerModal: document.getElementById('scanner-modal'),
  qrcodeContainer: document.getElementById('qrcode')
};

let username = localStorage.getItem('username') || '';
let peerConnection = null;
let dataChannel = null;
let signalingSocket = null;
let connectedPeers = new Map();
let isHosting = false;
let localNetworkId = generateNetworkId();

// -----------------------------
// INITIALISATION
// -----------------------------
window.addEventListener('load', () => {
  initUsernameModal();
  initEventListeners();
  initNetworkDiscovery();
  updateConnectionOptions();
});

function initEventListeners() {
  dom.btnSend.addEventListener('click', sendText);
  dom.btnScan.addEventListener('click', scanDevices);
  dom.directConnectBtn.addEventListener('click', showQRCode);
  document.getElementById('qrcode-close').addEventListener('click', () => {
    dom.qrcodeModal.style.display = 'none';
  });
  document.getElementById('scanner-close').addEventListener('click', () => {
    dom.scannerModal.style.display = 'none';
  });
}

// -----------------------------
// DÉCOUVERTE RÉSEAU
// -----------------------------
function initNetworkDiscovery() {
  // Détection automatique des pairs sur le même réseau
  startMDNSDiscovery();
  
  // Vérifie périodiquement l'état du réseau
  setInterval(checkNetworkStatus, 5000);
}

function startMDNSDiscovery() {
  // Simule la découverte mDNS
  updateStatus('🔍 Recherche d\'appareils à proximité...');
  
  setTimeout(() => {
    // Simule la découverte d'appareils
    const mockDevices = [
      { id: 'device1', name: 'Jean-PC', type: 'pc', distance: 'à 2m' },
      { id: 'device2', name: 'Marie-Phone', type: 'phone', distance: 'à proximité' }
    ];
    
    renderDevices(mockDevices);
    updateConnectionOptions();
  }, 2000);
}

function checkNetworkStatus() {
  const isSameNetwork = Math.random() > 0.2; // 80% de chance d'être sur le même réseau
  
  if (!isSameNetwork) {
    dom.connectionOptions.style.display = 'block';
    updateStatus('⚠️ Connectez-vous au même Wi-Fi pour détecter les appareils');
  }
}

// -----------------------------
// WEBRTC - CONNEXION DIRECTE
// -----------------------------
async function createPeerConnection() {
  try {
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = handleICECandidate;
    peerConnection.ondatachannel = handleDataChannel;
    
    return true;
  } catch (error) {
    console.error('Erreur création WebRTC:', error);
    updateStatus('❌ Votre navigateur ne supporte pas la connexion directe', 'error');
    return false;
  }
}

function handleICECandidate(event) {
  if (event.candidate) {
    // Envoyer le candidat ICE à l'autre appareil
    broadcastToPeers({
      type: 'candidate',
      candidate: event.candidate
    });
  }
}

function handleDataChannel(event) {
  dataChannel = event.channel;
  setupDataChannel();
}

function setupDataChannel() {
  dataChannel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'text') {
      addRecvRecord(data.sender, data.text);
      updateStatus(`Message reçu de ${data.sender}`);
    }
  };
  
  dataChannel.onopen = () => updateStatus('✅ Canal de données ouvert');
  dataChannel.onclose = () => updateStatus('❌ Canal fermé');
}

async function connectToPeer(peerId) {
  if (!peerConnection) await createPeerConnection();
  
  dataChannel = peerConnection.createDataChannel('textChannel');
  setupDataChannel();
  
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  broadcastToPeers({
    type: 'offer',
    offer: offer,
    target: peerId
  });
}

async function handleOffer(offer, source) {
  if (!peerConnection) await createPeerConnection();
  
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  broadcastToPeers({
    type: 'answer',
    answer: answer,
    target: source
  });
}

// -----------------------------
// FONCTIONS UTILITAIRES
// -----------------------------
function generateNetworkId() {
  return Math.random().toString(36).substring(2, 8);
}

function renderDevices(devices) {
  if (!devices.length) {
    dom.listDevices.innerHTML = '<li class="device-item">Aucun appareil détecté</li>';
    return;
  }
  
  dom.listDevices.innerHTML = devices.map(device => `
    <li class="device-item" data-id="${device.id}">
      <div class="device-icon">${device.type === 'phone' ? '📱' : '💻'}</div>
      <div class="device-info">
        <div class="device-name">${device.name}</div>
        <div class="device-status">${device.distance}</div>
      </div>
      <button class="connect-btn">🔗</button>
    </li>
  `).join('');
  
  document.querySelectorAll('.device-item').forEach(item => {
    item.addEventListener('click', () => {
      const deviceId = item.dataset.id;
      const deviceName = item.querySelector('.device-name').textContent;
      connectToPeer(deviceId);
      updateStatus(`Connexion à ${deviceName}...`);
    });
  });
}

function updateStatus(msg, type = '') {
  dom.statusTransfer.textContent = msg;
  dom.statusTransfer.className = `status ${type}`;
}

function updateConnectionOptions() {
  const deviceCount = dom.listDevices.querySelectorAll('.device-item').length;
  dom.connectionOptions.style.display = deviceCount > 1 ? 'none' : 'block';
}

// -----------------------------
// GESTION QR CODE
// -----------------------------
function showQRCode() {
  const connectionData = JSON.stringify({
    networkId: localNetworkId,
    username: username
  });
  
  // Générer le QR code
  dom.qrcodeContainer.innerHTML = '';
  QRCode.toCanvas(dom.qrcodeContainer, connectionData, { width: 200 }, (error) => {
    if (error) console.error('Erreur QR code:', error);
  });
  
  dom.qrcodeModal.style.display = 'block';
  updateStatus('🔗 Partagez ce QR code pour connecter un appareil');
}

function scanQRCode() {
  dom.scannerModal.style.display = 'block';
  // Dans une vraie implémentation, vous utiliseriez une bibliothèque comme Instascan ici
}

// -----------------------------
// ENVOI/RÉCEPTION DE TEXTE
// -----------------------------
function sendText() {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    return updateStatus('❌ Connectez-vous d\'abord à un appareil', 'error');
  }
  
  const text = dom.inputText.value.trim();
  if (!text) return updateStatus('❌ Entrez du texte à envoyer', 'error');
  
  try {
    dataChannel.send(JSON.stringify({
      type: 'text',
      sender: username,
      text: text
    }));
    
    updateStatus('✅ Texte envoyé');
    addSendRecord(selectedDevice.name, text);
    dom.inputText.value = '';
  } catch (error) {
    updateStatus('❌ Échec de l\'envoi', 'error');
  }
}

function addSendRecord(to, text) {
  const history = JSON.parse(localStorage.getItem('sendHistory') || '[]');
  history.unshift({ to, text, date: new Date().toISOString() });
  localStorage.setItem('sendHistory', JSON.stringify(history));
}

function addRecvRecord(from, text) {
  const history = JSON.parse(localStorage.getItem('recvHistory') || '[]');
  history.unshift({ from, text, date: new Date().toISOString() });
  localStorage.setItem('recvHistory', JSON.stringify(history));
}

// -----------------------------
// GESTION UTILISATEUR
// -----------------------------
function initUsernameModal() {
  if (username) return;
  
  const modal = document.getElementById('username-modal');
  const input = document.getElementById('username-input');
  const submit = document.getElementById('username-submit');
  
  modal.style.display = 'block';
  
  submit.addEventListener('click', () => {
    const newUsername = input.value.trim();
    if (newUsername.length < 2) return;
    
    username = newUsername;
    localStorage.setItem('username', username);
    modal.style.display = 'none';
  });
}

// -----------------------------
// SIMULATION RÉSEAU (à remplacer par une vraie implémentation)
// -----------------------------
function broadcastToPeers(message) {
  console.log('Broadcast:', message);
  // Dans une vraie implémentation, ceci enverrait le message via WebSocket ou WebRTC
}

function scanDevices() {
  updateStatus('🔍 Recherche en cours...');
  setTimeout(() => {
    const mockDevices = [
      { id: 'dev-' + Date.now(), name: 'Appareil Proche', type: 'phone', distance: 'à 3m' }
    ];
    renderDevices(mockDevices);
    updateConnectionOptions();
  }, 1500);
}