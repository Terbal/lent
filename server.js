const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        // Relaie les messages entre appareils
        if (data.targetId && clients.has(data.targetId)) {
            clients.get(data.targetId).send(JSON.stringify(data));
        }
    });

    const clientId = generateId();
    clients.set(clientId, ws);
    ws.send(JSON.stringify({ type: "id", clientId }));
    
    ws.on('close', () => clients.delete(clientId));
});

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}