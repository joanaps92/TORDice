const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { connectDB, Roll, Room } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Estado en memoria para usuarios conectados
const activeUsers = {};

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Enviar lista de salas a todos
async function emitRoomList() {
    try {
        const rooms = await Room.distinct('name');
        io.emit('update-rooms', rooms);
    } catch (err) {
        console.error('Error al obtener lista de salas:', err);
    }
}

// Enviar lista de usuarios de una sala con sus posiciones
function emitUserList(roomName) {
    const usersInRoom = Object.entries(activeUsers)
        .filter(([id, u]) => u.room === roomName)
        .map(([id, u]) => ({
            id,
            username: u.username,
            stance: u.stance || 'Posición abierta'
        }));
    io.to(roomName).emit('update-room-users', usersInRoom);
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    emitRoomList();

    socket.on('join-room', async ({ roomName, username, stance }) => {
        try {
            socket.join(roomName);
            activeUsers[socket.id] = {
                username: username || 'Aventurero',
                room: roomName,
                stance: stance || 'Posición abierta'
            };
            console.log(`Usuario ${username} unido a la sala: ${roomName} con postura: ${activeUsers[socket.id].stance}`);

            const existing = await Room.findOne({ name: roomName });
            if (!existing) {
                await Room.create({ name: roomName });
                emitRoomList();
            }

            const history = await Roll.find({ room: roomName })
                .sort({ createdAt: -1 })
                .limit(50);
            socket.emit('load-history', history);

            emitUserList(roomName);
        } catch (err) {
            console.error('Error en join-room:', err);
        }
    });

    socket.on('update-user', ({ username, stance }) => {
        try {
            const user = activeUsers[socket.id];
            if (user) {
                if (username && typeof username === 'string' && username.trim().length > 0) {
                    user.username = username.trim();
                }
                if (stance && typeof stance === 'string') {
                    user.stance = stance;
                }
                console.log(`Usuario ${socket.id} actualizado: ${user.username} - ${user.stance} en sala ${user.room}`);
                emitUserList(user.room);
            }
        } catch (err) {
            console.error('Error en update-user:', err);
        }
    });

    socket.on('clear-history', async (roomName) => {
        try {
            await Roll.deleteMany({ room: roomName });
            console.log(`Historial borrado en la sala: ${roomName}`);
            io.to(roomName).emit('load-history', []);

            const hasUsers = Object.values(activeUsers)
                .some(u => u.room === roomName);
            if (!hasUsers) {
                await Room.deleteOne({ name: roomName });
                console.log(`Sala eliminada por falta de usuarios: ${roomName}`);
                emitRoomList();
            }
        } catch (err) {
            console.error('Error en clear-history:', err);
        }
    });

    socket.on('delete-room', async (roomName) => {
        try {
            await Roll.deleteMany({ room: roomName });
            await Room.deleteOne({ name: roomName });
            console.log(`Sala eliminada: ${roomName}`);
            emitRoomList();
            io.to(roomName).emit('room-deleted');
        } catch (err) {
            console.error('Error en delete-room:', err);
        }
    });

    socket.on('roll-dice', async (payload) => {
        try {
            const { room, user, d12Count, d6Count, stance } = payload;
            const currentUserObj = activeUsers[socket.id];
            const senderName = user || currentUserObj?.username || 'Aventurero';
            const senderStance = stance || currentUserObj?.stance || 'Posición abierta';

            const d12Results = Array.from({ length: d12Count }, () => Math.floor(Math.random() * 12) + 1);
            const d6Results = Array.from({ length: d6Count }, () => Math.floor(Math.random() * 6) + 1);
            const total = [...d12Results, ...d6Results].reduce((a, b) => a + b, 0);

            const rollEntry = {
                room,
                user: senderName,
                stance: senderStance,
                d12Results,
                d6Results,
                total,
                timestamp: new Date().toLocaleTimeString()
            };

            await Roll.create(rollEntry);
            io.to(room).emit('new-roll', rollEntry);
        } catch (err) {
            console.error('Error en roll-dice:', err);
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            const room = user.room;
            delete activeUsers[socket.id];
            emitUserList(room);
        }
        console.log('Usuario desconectado');
    });
});

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Error al conectar a MongoDB:', err);
    process.exit(1);
});
