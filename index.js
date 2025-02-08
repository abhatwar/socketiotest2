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
        rooms.set(data.room, { users: new Set(), messages: [] });
        broadcastRoomList();
      }
    }

    if (data.type === 'joinRoom') {
      leaveCurrentRoom(ws);
      if (!rooms.has(data.room)) {
        rooms.set(data.room, { users: new Set(), messages: [] });
      }
      rooms.get(data.room).users.add(ws);
      ws.currentRoom = data.room;

      // Send chat history when a user joins
      const chatHistory = rooms.get(data.room).messages;
      ws.send(JSON.stringify({ type: 'roomJoined', room: data.room, history: chatHistory }));

      broadcastRoomList();
      broadcastToRoom(data.room, { type: 'userJoined', name: clients.get(ws) });
    }

    if (data.type === 'leaveRoom') {
      leaveCurrentRoom(ws);
      broadcastRoomList();
    }

    if (data.type === 'sendMessage') {
      if (ws.currentRoom) {
        const messageObj = { id: Date.now(), user: clients.get(ws), text: data.text, sender: ws };
        rooms.get(ws.currentRoom).messages.push(messageObj);
        broadcastToRoom(ws.currentRoom, { type: 'newMessage', message: messageObj });
      }
    }

    if (data.type === 'editMessage') {
      if (ws.currentRoom) {
        const room = rooms.get(ws.currentRoom);
        const message = room.messages.find(msg => msg.id === data.id);
        if (message && message.sender === ws) {
          message.text = data.text;
          broadcastToRoom(ws.currentRoom, { type: 'updateMessage', id: data.id, text: data.text });
        }
      }
    }

    if (data.type === 'deleteMessage') {
      if (ws.currentRoom) {
        const room = rooms.get(ws.currentRoom);
        const index = room.messages.findIndex(msg => msg.id === data.id);
        if (index !== -1 && room.messages[index].sender === ws) {
          room.messages.splice(index, 1);
          broadcastToRoom(ws.currentRoom, { type: 'removeMessage', id: data.id });
        }
      }
    }

    if (data.type === 'typing') {
      if (ws.currentRoom) {
        broadcastToRoom(ws.currentRoom, { type: 'typing', name: clients.get(ws) });
      }
    }

    if (data.type === 'stopTyping') {
      if (ws.currentRoom) {
        broadcastToRoom(ws.currentRoom, { type: 'stopTyping', name: clients.get(ws) });
      }
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
        room.users.delete(ws);
        broadcastToRoom(ws.currentRoom, { type: 'userLeft', name: clients.get(ws) });

        if (room.users.size === 0) {
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
      rooms.get(room).users.forEach(client => {
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
