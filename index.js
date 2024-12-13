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

// Store usernames and typing status
const clients = new Map();
const typingUsers = new Set();

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
      
      // Notify other clients about the new user
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(`${message} has joined the chat.`);
        }
      });
      return;
    }

    const username = clients.get(ws);

    if (message === 'typing') {
      // Handle typing status
      typingUsers.add(username);
      broadcastTypingStatus();
      return;
    }

    if (message === 'stopped typing') {
      // Handle stopped typing status
      typingUsers.delete(username);
      broadcastTypingStatus();
      return;
    }

    // Broadcast the message to all connected clients
    console.log(`${username}: ${message}`);
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
    typingUsers.delete(username);
    console.log(`${username} disconnected.`);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`${username} has left the chat.`);
      }
    });
  });
});

// Function to broadcast typing status
function broadcastTypingStatus() {
  let typingMessage = '';
  if (typingUsers.size > 0) {
    typingMessage = `${[...typingUsers].join(', ')} ${typingUsers.size > 1 ? 'are' : 'is'} typing...`;
  }

  // Broadcast typing status to all clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(typingMessage);
    }
  });
}

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
