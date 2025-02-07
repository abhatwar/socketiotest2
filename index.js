// Importing required libraries
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Create an Express app
const app = express();

// Serve the frontend HTML
app.use(express.static(path.join(__dirname, 'public')));

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Store usernames and messages
const clients = new Map();
let messages = [];

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('A new client connected!');

  ws.send(JSON.stringify({ type: 'init', messages }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'setName') {
      clients.set(ws, data.name);
      broadcast({ type: 'userJoined', name: data.name });
      return;
    }

    if (data.type === 'sendMessage') {
      const msgObj = { id: Date.now(), user: clients.get(ws), text: data.text };
      messages.push(msgObj);
      broadcast({ type: 'newMessage', message: msgObj });
      return;
    }

    if (data.type === 'editMessage') {
      const msgIndex = messages.findIndex(msg => msg.id === data.id);
      if (msgIndex !== -1 && messages[msgIndex].user === clients.get(ws)) {
        messages[msgIndex].text = data.text;
        broadcast({ type: 'updateMessage', id: data.id, text: data.text });
      }
      return;
    }

    if (data.type === 'deleteMessage') {
      const msgIndex = messages.findIndex(msg => msg.id === data.id);
      if (msgIndex !== -1 && messages[msgIndex].user === clients.get(ws)) {
        messages.splice(msgIndex, 1);
        broadcast({ type: 'removeMessage', id: data.id });
      }
      return;
    }
  });

  ws.on('close', () => {
    const username = clients.get(ws);
    clients.delete(ws);
    broadcast({ type: 'userLeft', name: username });
  });
});

// Function to broadcast messages to all clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
