const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Handle root request
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let rooms = {}; // Stores chat rooms and their users/messages

wss.on('connection', (ws) => {
    let user = { name: null, room: null };

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'setName') {
            user.name = data.name;
            sendRooms();
        }

        if (data.type === 'getRooms') {
            sendRooms();
        }

        if (data.type === 'createRoom') {
            if (!rooms[data.room]) {
                rooms[data.room] = { users: [], messages: [] };
            }
            sendRooms();
        }

        if (data.type === 'joinRoom') {
            user.room = data.room;
            if (!rooms[user.room]) {
                rooms[user.room] = { users: [], messages: [] };
            }
            rooms[user.room].users.push(ws);
            broadcast(user.room, { type: 'newMessage', message: { user: 'System', text: `${user.name} joined` } });
            sendRoomMessages(ws, user.room);
            sendRooms();
        }

        if (data.type === 'sendMessage') {
            if (user.room && rooms[user.room]) {
                const msg = { id: Date.now(), user: user.name, text: data.text };
                rooms[user.room].messages.push(msg);
                broadcast(user.room, { type: 'newMessage', message: msg });
            }
        }

        if (data.type === 'editMessage') {
            if (user.room && rooms[user.room]) {
                rooms[user.room].messages = rooms[user.room].messages.map(msg => {
                    if (msg.id === data.id && msg.user === user.name) {
                        msg.text = data.text;
                        broadcast(user.room, { type: 'updateMessage', id: msg.id, text: msg.text, user: msg.user });
                    }
                    return msg;
                });
            }
        }

        if (data.type === 'deleteMessage') {
            if (user.room && rooms[user.room]) {
                rooms[user.room].messages = rooms[user.room].messages.filter(msg => msg.id !== data.id || msg.user !== user.name);
                broadcast(user.room, { type: 'removeMessage', id: data.id });
            }
        }

        if (data.type === 'leaveRoom') {
            leaveRoom(ws);
        }

        if (data.type === 'typing') {
            broadcast(user.room, { type: 'typing', name: user.name });
        }

        if (data.type === 'stopTyping') {
            broadcast(user.room, { type: 'stopTyping' });
        }
    });

    ws.on('close', () => {
        leaveRoom(ws);
    });

    function leaveRoom(ws) {
        if (user.room && rooms[user.room]) {
            rooms[user.room].users = rooms[user.room].users.filter(client => client !== ws);
            broadcast(user.room, { type: 'newMessage', message: { user: 'System', text: `${user.name} left` } });
            if (rooms[user.room].users.length === 0) {
                delete rooms[user.room];
            }
            sendRooms();
        }
    }

    function broadcast(room, data) {
        if (rooms[room]) {
            rooms[room].users.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    }

    function sendRooms() {
        const roomList = Object.keys(rooms);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'roomList', rooms: roomList }));
            }
        });
    }

    function sendRoomMessages(ws, room) {
        if (rooms[room]) {
            rooms[room].messages.forEach(msg => {
                ws.send(JSON.stringify({ type: 'newMessage', message: msg }));
            });
        }
    }
});

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
