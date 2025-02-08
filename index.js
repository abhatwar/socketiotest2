// Importing required libraries
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Create an Express app
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Create an HTTP server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store clients, rooms, and messages
const clients = new Map();
const rooms = new Map();

wss.on('connection', (ws) => {
  console.log('A new client connected!');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'setName') {
      clients.set(ws, data.name);
      ws.send(JSON.stringify({ type: 'roomList', rooms: Array.from(rooms.keys()) }));
    }

    if (data.type === 'getRooms') {
      ws.send(JSON.stringify({ type: 'roomList', rooms: Array.from(rooms.keys()) }));
    }

    if (data.type === 'createRoom') {
      if (!rooms.has(data.room)) {
        rooms.set(data.room, new Set());
        broadcastRoomList();
      }
    }

    if (data.type === 'joinRoom') {
      leaveCurrentRoom(ws);
      if (!rooms.has(data.room)) {
        rooms.set(data.room, new Set());
      }
      rooms.get(data.room).add(ws);
      ws.currentRoom = data.room;
      ws.send(JSON.stringify({ type: 'roomJoined', room: data.room }));
      broadcastRoomList();
    }

    if (data.type === 'leaveRoom') {
      leaveCurrentRoom(ws);
      broadcastRoomList();
    }

    if (data.type === 'sendMessage') {
      const messageObj = { id: Date.now(), user: clients.get(ws), text: data.text };
      broadcastToRoom(data.room, { type: 'newMessage', message: messageObj });
    }

    if (data.type === 'editMessage') {
      broadcastToRoom(ws.currentRoom, { type: 'updateMessage', id: data.id, text: data.text });
    }

    if (data.type === 'deleteMessage') {
      broadcastToRoom(ws.currentRoom, { type: 'removeMessage', id: data.id });
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws);
    clients.delete(ws);
    broadcastRoomList();
  });

  function leaveCurrentRoom(ws) {
    if (ws.currentRoom) {
      const room = rooms.get(ws.currentRoom);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(ws.currentRoom);
        }
      }
      ws.currentRoom = null;
    }
  }

  function broadcastRoomList() {
    const roomList = Array.from(rooms.keys());
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'roomList', rooms: roomList }));
      }
    });
  }

  function broadcastToRoom(room, message) {
    if (rooms.has(room)) {
      rooms.get(room).forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
