const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { connectDB, Roll, Room, Adventurer, User } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_tordice';

// Nodemailer config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'joanaps92@gmail.com',
        pass: process.env.EMAIL_PASS || ''
    }
});

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

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Requiere permisos de administrador' });
    }
    next();
};

const isAdventurerOwner = (adventurer, req) => adventurer.ownerId && adventurer.ownerId.toString() === req.user.id.toString();

const canViewAdventurer = (adventurer, req) => {
    if (req.user.role === 'admin' || isAdventurerOwner(adventurer, req)) return true;
    if (adventurer.visibility === 'all') return true;
    return adventurer.visibility === 'selected'
        && Array.isArray(adventurer.visibleTo)
        && adventurer.visibleTo.some(userId => userId.toString() === req.user.id.toString());
};

const canEditAdventurer = (adventurer, req) => req.user.role === 'admin' || isAdventurerOwner(adventurer, req);

// --- AUTHENTICATION ROUTES ---

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({
            token,
            user: { username: user.username, role: user.role, email: user.email },
            needsEmail: !user.email
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/setup-email', authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const user = await User.findById(req.user.id);
        if (user.email) return res.status(400).json({ error: 'El usuario ya tiene un email configurado' });

        user.email = email;
        await user.save();
        res.json({ success: true, message: 'Email configurado correctamente' });
    } catch (err) {
        console.error('Error en setup-email:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !user.email) {
            return res.status(400).json({ error: 'Usuario no encontrado o no tiene email configurado.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
        user.resetPasswordCode = code;
        user.resetPasswordExpires = Date.now() + 20 * 60 * 1000; // 20 mins
        await user.save();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'joanaps92@gmail.com',
            to: user.email,
            subject: 'Código de recuperación de contraseña - TORDice',
            text: `Tu código para restablecer la contraseña es: ${code}\nEste código caducará en 20 minutos.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error enviando email:', error);
                return res.status(500).json({ error: 'Error al enviar el correo electrónico. Revisa la configuración.' });
            }
            res.json({ success: true, message: 'Correo enviado' });
        });
    } catch (err) {
        console.error('Error en forgot-password:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { username, code, newPassword } = req.body;
        const user = await User.findOne({ 
            username, 
            resetPasswordCode: code, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ error: 'Código inválido o caducado.' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error('Error en reset-password:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// --- ADMIN ROUTES ---

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // No devolver contraseñas
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (username.includes(' ')) return res.status(400).json({ error: 'El nombre de usuario no puede contener espacios' });
        
        const exists = await User.findOne({ username });
        if (exists) return res.status(400).json({ error: 'El usuario ya existe' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || '676767', salt);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            role: role || 'user'
        });

        res.status(201).json({ id: newUser._id, username: newUser.username, role: newUser.role });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (username) {
             if (username.includes(' ')) return res.status(400).json({ error: 'El nombre de usuario no puede contener espacios' });
             user.username = username;
        }
        if (email !== undefined) user.email = email;
        if (role) user.role = role;
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

app.get('/api/admin/adventurers', authenticateToken, isAdmin, async (_req, res) => {
    try {
        const adventurers = await Adventurer.find()
            .sort({ updatedAt: -1 })
            .populate('ownerId', 'username role')
            .populate('visibleTo', 'username role')
            .lean();
        res.json(adventurers);
    } catch (err) {
        console.error('Error al listar visibilidad de aventureros:', err);
        res.status(500).json({ error: 'No se pudo cargar la visibilidad de las hojas.' });
    }
});

app.put('/api/admin/adventurers/:id/visibility', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { ownerId, visibility = 'private', visibleTo = [] } = req.body;
        if (!['private', 'selected', 'all'].includes(visibility)) {
            return res.status(400).json({ error: 'Tipo de visibilidad no válido.' });
        }

        const normalizedOwnerId = ownerId ? String(ownerId) : null;
        if (normalizedOwnerId && !mongoose.Types.ObjectId.isValid(normalizedOwnerId)) {
            return res.status(400).json({ error: 'El propietario indicado no es válido.' });
        }

        const requestedUsers = Array.isArray(visibleTo) ? visibleTo.map(String) : [];
        const uniqueUserIds = [...new Set(requestedUsers)];
        if (uniqueUserIds.some(userId => !mongoose.Types.ObjectId.isValid(userId))) {
            return res.status(400).json({ error: 'Hay usuarios autorizados no válidos.' });
        }
        if (normalizedOwnerId) {
            const ownerIndex = uniqueUserIds.indexOf(normalizedOwnerId);
            if (ownerIndex !== -1) uniqueUserIds.splice(ownerIndex, 1);
        }

        const adventurer = await Adventurer.findById(req.params.id);
        if (!adventurer) return res.status(404).json({ error: 'Aventurero no encontrado.' });

        if (normalizedOwnerId) {
            const owner = await User.exists({ _id: normalizedOwnerId });
            if (!owner) return res.status(400).json({ error: 'El propietario indicado no existe.' });
        }
        if (uniqueUserIds.length) {
            const users = await User.find({ _id: { $in: uniqueUserIds } }).select('_id').lean();
            if (users.length !== uniqueUserIds.length) return res.status(400).json({ error: 'Uno de los usuarios autorizados no existe.' });
        }

        adventurer.ownerId = normalizedOwnerId || undefined;
        adventurer.visibility = visibility;
        adventurer.visibleTo = visibility === 'selected' ? uniqueUserIds : [];
        await adventurer.save();

        const updated = await Adventurer.findById(adventurer._id)
            .populate('ownerId', 'username role')
            .populate('visibleTo', 'username role')
            .lean();
        res.json(updated);
    } catch (err) {
        console.error('Error al actualizar visibilidad de aventurero:', err);
        res.status(400).json({ error: 'No se pudo actualizar la visibilidad de la hoja.' });
    }
});


// Aventureros: el cliente conserva el mismo documento JSON que usa la ficha.
app.get('/api/adventurers', authenticateToken, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? {}
            : {
                $or: [
                    { ownerId: req.user.id },
                    { visibility: 'all' },
                    { visibility: 'selected', visibleTo: req.user.id }
                ]
            };
        const adventurers = await Adventurer.find(query).sort({ updatedAt: -1 }).lean();
        res.json(adventurers);
    } catch (err) {
        console.error('Error al listar aventureros:', err);
        res.status(500).json({ error: 'No se pudieron cargar los aventureros.' });
    }
});

app.post('/api/adventurers', authenticateToken, async (req, res) => {
    try {
        const ficha = req.body;
        const nombre = ficha?.informacionGeneral?.nombre?.trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre del aventurero es obligatorio.' });
        const duplicate = await Adventurer.findOne({ nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        if (duplicate) return res.status(409).json({ error: 'Ya existe una hoja con ese nombre. Elige otro nombre.' });
        const adventurer = await Adventurer.create({
            nombre,
            trancos: Boolean(ficha.trancos),
            ficha,
            ownerId: req.user.id,
            visibility: 'private',
            visibleTo: [],
            updatedAt: new Date()
        });
        res.status(201).json(adventurer);
    } catch (err) {
        console.error('Error al crear aventurero:', err);
        res.status(400).json({ error: 'No se pudo guardar la ficha.' });
    }
});

app.put('/api/adventurers/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await Adventurer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Aventurero no encontrado.' });
        if (!canViewAdventurer(existing, req)) return res.status(403).json({ error: 'No tienes permiso para ver esta hoja.' });
        if (!canEditAdventurer(existing, req)) return res.status(403).json({ error: 'Solo el propietario o un administrador puede editar esta hoja.' });

        const ficha = req.body;
        const nombre = ficha?.informacionGeneral?.nombre?.trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre del aventurero es obligatorio.' });
        const duplicate = await Adventurer.findOne({ _id: { $ne: req.params.id }, nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        if (duplicate) return res.status(409).json({ error: 'Ya existe otra hoja con ese nombre. Elige otro nombre.' });
        const adventurer = await Adventurer.findByIdAndUpdate(req.params.id, { nombre, trancos: Boolean(ficha.trancos), ficha, updatedAt: new Date() }, { new: true, runValidators: true });
        res.json(adventurer);
    } catch (err) {
        console.error('Error al actualizar aventurero:', err);
        res.status(400).json({ error: 'No se pudo actualizar la ficha.' });
    }
});

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
            stance: u.stance || 'Posición abierta',
            adventurerId: u.adventurerId || null,
            adventurerName: u.adventurerName || ''
        }));
    io.to(roomName).emit('update-room-users', usersInRoom);
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Authentication error"));
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Authentication error"));
        socket.user = decoded;
        next();
    });
});

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id, 'User:', socket.user.username);

    emitRoomList();

    socket.on('join-room', async ({ roomName, username, stance, adventurerId, adventurerName }) => {
        try {
            socket.join(roomName);
            activeUsers[socket.id] = {
                username: socket.user.username, // Usa el username validado del token
                room: roomName,
                stance: stance || 'Posición abierta',
                adventurerId: adventurerId || null,
                adventurerName: adventurerName || ''
            };
            console.log(`Usuario ${socket.user.username} unido a la sala: ${roomName} con postura: ${activeUsers[socket.id].stance}`);

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

    socket.on('update-user', ({ stance, adventurerId, adventurerName }) => {
        try {
            const user = activeUsers[socket.id];
            if (user) {
                if (stance && typeof stance === 'string') {
                    user.stance = stance;
                }
                if (adventurerId !== undefined) {
                    user.adventurerId = adventurerId || null;
                    user.adventurerName = adventurerName || '';
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
            const { room, d12Count, d6Count, stance } = payload;
            const currentUserObj = activeUsers[socket.id];
            const senderName = socket.user.username; // Usa el usuario logueado
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

async function seedDatabase() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            console.log('Sembrando base de datos con usuarios por defecto...');
            const salt = await bcrypt.genSalt(10);
            const defaultPassword = await bcrypt.hash('676767', salt);

            const usersToInsert = [
                { username: 'Panda', password: defaultPassword, role: 'admin' },
                { username: 'El_Xavista', password: defaultPassword, role: 'user' },
                { username: 'Marco', password: defaultPassword, role: 'user' },
                { username: 'White', password: defaultPassword, role: 'user' },
                { username: 'Vaeltas', password: defaultPassword, role: 'user' }
            ];

            await User.insertMany(usersToInsert);
            console.log('Usuarios por defecto creados.');
        }
    } catch (err) {
        console.error('Error al sembrar la base de datos:', err);
    }
}

connectDB().then(async () => {
    await seedDatabase();
    server.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Error al conectar a MongoDB:', err);
    process.exit(1);
});
