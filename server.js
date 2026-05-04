const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // En producción puedes restringirlo a tu dominio de Render
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Estado en memoria para usuarios conectados
const activeUsers = {}; // socket.id -> { username, room }

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Inicializar archivo JSON si no existe
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ rooms: {} }, null, 2));
}

// Cargar datos
function loadData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { rooms: {} };
    }
}

// Guardar datos
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Enviar lista de salas a todos
function emitRoomList() {
    const data = loadData();
    const roomNames = Object.keys(data.rooms);
    io.emit('update-rooms', roomNames);
}

// Enviar lista de usuarios de una sala
function emitUserList(roomName) {
    const usersInRoom = Object.values(activeUsers)
        .filter(u => u.room === roomName)
        .map(u => u.username);
    io.to(roomName).emit('update-room-users', usersInRoom);
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // Enviar lista de salas al conectar
    emitRoomList();

    socket.on('join-room', ({ roomName, username }) => {
        socket.join(roomName);
        activeUsers[socket.id] = { username, room: roomName };
        console.log(`Usuario ${username} unido a la sala: ${roomName}`);
        
        // Enviar historial de la sala al usuario que se conecta
        const data = loadData();
        const history = data.rooms[roomName] || [];
        socket.emit('load-history', history);

        // Actualizar lista de usuarios para todos en la sala
        emitUserList(roomName);
    });

    socket.on('clear-history', (roomName) => {
        const data = loadData();
        if (data.rooms[roomName]) {
            data.rooms[roomName] = [];
            saveData(data);
            console.log(`Historial borrado en la sala: ${roomName}`);
            io.to(roomName).emit('load-history', []);
        }
    });

    socket.on('delete-room', (roomName) => {
        const data = loadData();
        if (data.rooms[roomName]) {
            delete data.rooms[roomName];
            saveData(data);
            console.log(`Sala eliminada: ${roomName}`);
            emitRoomList();
            // Opcional: desconectar a los usuarios de esa sala o avisarles
            io.to(roomName).emit('room-deleted');
        }
    });

    socket.on('roll-dice', (payload) => {
        const { room, user, d12Count, d6Count } = payload;
        
        const d12Results = Array.from({ length: d12Count }, () => Math.floor(Math.random() * 12) + 1);
        const d6Results = Array.from({ length: d6Count }, () => Math.floor(Math.random() * 6) + 1);
        
        const total = [...d12Results, ...d6Results].reduce((a, b) => a + b, 0);
        
        const rollEntry = {
            id: Date.now(),
            user,
            d12Results,
            d6Results,
            total,
            timestamp: new Date().toLocaleTimeString()
        };

        // Guardar en JSON
        const data = loadData();
        const isNewRoom = !data.rooms[room];
        if (!data.rooms[room]) data.rooms[room] = [];
        data.rooms[room].push(rollEntry);
        
        // Limitar historial a las últimas 50 tiradas para no saturar el JSON
        if (data.rooms[room].length > 50) {
            data.rooms[room].shift();
        }
        
        saveData(data);

        // Emitir a todos en la sala
        io.to(room).emit('new-roll', rollEntry);

        // Si es una sala nueva, actualizar lista de salas para todos
        if (isNewRoom) {
            emitRoomList();
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

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
