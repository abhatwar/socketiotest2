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

// Store usernames
const clients = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('A new client connected!');

  // Ask for the user's name
  ws.send('Please enter your name:');

  ws.on('message', (message) => {
    if (!clients.has(ws)) {
      // First message is the username
      clients.set(ws, message);
      console.log(`User connected: ${message}`);
      ws.send(`Welcome to the chat, ${message}!`);
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(`${message} has joined the chat.`);
        }
      });
      return;
    }

    const username = clients.get(ws);
    console.log(`${username}: ${message}`);

    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`${username}: ${message}`);
      }
    });
  });

  // Handle client disconnection
  ws.on('close', () => {
    const username = clients.get(ws);
    clients.delete(ws);
    console.log(`${username} disconnected.`);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`${username} has left the chat.`);
      }
    });
  });
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
