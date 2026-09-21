const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

class RoomError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.name = 'RoomError';
        this.code = code;
        this.status = status;
    }
}

function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
}

function publicRoom(room) {
    if (!room) return null;
    const source = typeof room.toObject === 'function' ? room.toObject() : room;
    return {
        id: String(source._id || source.id),
        code: source.code,
        name: source.name,
        ownerId: source.ownerId ? String(source.ownerId._id || source.ownerId) : null,
        maxMembers: source.maxMembers,
        status: source.status,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        members: (source.members || []).map(member => ({
            userId: String(member.userId?._id || member.userId),
            displayName: member.userId?.displayName || member.userId?.username || undefined,
            joinedAt: member.joinedAt
        }))
    };
}

class RoomService {
    constructor({ roomModel, hashPassword = password => bcrypt.hash(password, 12), comparePassword = (password, hash) => bcrypt.compare(password, hash), randomBytes = crypto.randomBytes } = {}) {
        if (!roomModel) throw new Error('RoomService necesita un modelo de sala.');
        this.roomModel = roomModel;
        this.hashPassword = hashPassword;
        this.comparePassword = comparePassword;
        this.randomBytes = randomBytes;
    }

    validateCreate({ name, password, maxMembers = 6 }) {
        const normalizedName = String(name || '').trim();
        const normalizedPassword = String(password || '');
        const normalizedMax = Number(maxMembers);
        if (normalizedName.length < 2 || normalizedName.length > 80) {
            throw new RoomError('ROOM_INVALID_NAME', 'El nombre debe tener entre 2 y 80 caracteres.');
        }
        if (normalizedPassword.length < 8 || normalizedPassword.length > 128) {
            throw new RoomError('ROOM_INVALID_PASSWORD', 'La contraseña debe tener entre 8 y 128 caracteres.');
        }
        if (!Number.isInteger(normalizedMax) || normalizedMax < 2 || normalizedMax > 50) {
            throw new RoomError('ROOM_INVALID_MAX_MEMBERS', 'El límite debe estar entre 2 y 50 jugadores.');
        }
        return { name: normalizedName, password: normalizedPassword, maxMembers: normalizedMax };
    }

    generateCode() {
        const bytes = this.randomBytes(ROOM_CODE_LENGTH);
        return [...bytes].map(byte => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
    }

    async create({ name, password, maxMembers = 6, ownerId }) {
        if (!ownerId) throw new RoomError('AUTH_REQUIRED', 'Debes iniciar sesión para crear una sala.', 401);
        const values = this.validateCreate({ name, password, maxMembers });
        const passwordHash = await this.hashPassword(values.password);
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const code = this.generateCode();
            if (await this.roomModel.exists({ code })) continue;
            try {
                const room = await this.roomModel.create({
                    name: values.name,
                    code,
                    ownerId,
                    passwordHash,
                    maxMembers: values.maxMembers,
                    status: 'waiting',
                    members: [{ userId: ownerId, joinedAt: new Date() }]
                });
                return publicRoom(room);
            } catch (error) {
                if (error?.code === 11000 && attempt < 4) continue;
                throw error;
            }
        }
        throw new RoomError('ROOM_CODE_UNAVAILABLE', 'No se pudo generar un código de sala único.', 503);
    }

    async findByCode(code, { withPassword = false } = {}) {
        const normalizedCode = normalizeCode(code);
        if (!/^[A-Z2-9]{6}$/.test(normalizedCode)) return null;
        let query = this.roomModel.findOne({ code: normalizedCode });
        if (withPassword && query && typeof query.select === 'function') query = query.select('+passwordHash');
        return query;
    }

    async join({ code, password, userId }) {
        if (!userId) throw new RoomError('AUTH_REQUIRED', 'Debes iniciar sesión para entrar en una sala.', 401);
        const room = await this.findByCode(code, { withPassword: true });
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'La sala no existe.', 404);
        if (room.status === 'closed') throw new RoomError('ROOM_CLOSED', 'La sala está cerrada.', 409);
        if (!await this.comparePassword(String(password || ''), room.passwordHash)) {
            throw new RoomError('ROOM_INVALID_PASSWORD', 'La contraseña de la sala no es válida.', 401);
        }
        const alreadyMember = (room.members || []).some(member => String(member.userId) === String(userId));
        if (!alreadyMember && room.members.length >= room.maxMembers) {
            throw new RoomError('ROOM_FULL', 'La sala ha alcanzado su límite de jugadores.', 409);
        }
        if (!alreadyMember) {
            room.members.push({ userId, joinedAt: new Date() });
            room.updatedAt = new Date();
            await room.save();
        }
        return publicRoom(room);
    }

    async getMemberRoom({ code, userId }) {
        const room = await this.findByCode(code);
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'La sala no existe.', 404);
        if (!(room.members || []).some(member => String(member.userId) === String(userId))) {
            throw new RoomError('ROOM_ACCESS_DENIED', 'No tienes acceso a esta sala.', 403);
        }
        return publicRoom(room);
    }

    async leave({ code, userId }) {
        const room = await this.findByCode(code);
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'La sala no existe.', 404);
        room.members = (room.members || []).filter(member => String(member.userId) !== String(userId));
        room.updatedAt = new Date();
        await room.save();
        return publicRoom(room);
    }

    async update({ code, userId, patch }) {
        const room = await this.findByCode(code);
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'La sala no existe.', 404);
        if (String(room.ownerId) !== String(userId)) throw new RoomError('ROOM_OWNER_REQUIRED', 'Solo el propietario puede modificar la sala.', 403);
        const allowed = {};
        if (patch.name !== undefined) {
            const name = String(patch.name).trim();
            if (name.length < 2 || name.length > 80) throw new RoomError('ROOM_INVALID_NAME', 'El nombre debe tener entre 2 y 80 caracteres.');
            allowed.name = name;
        }
        if (patch.maxMembers !== undefined) {
            const maxMembers = Number(patch.maxMembers);
            if (!Number.isInteger(maxMembers) || maxMembers < room.members.length || maxMembers > 50) throw new RoomError('ROOM_INVALID_MAX_MEMBERS', 'El límite no puede ser inferior a los miembros actuales ni superior a 50.');
            allowed.maxMembers = maxMembers;
        }
        if (patch.status !== undefined) {
            if (!['waiting', 'active', 'closed'].includes(patch.status)) throw new RoomError('ROOM_INVALID_STATUS', 'Estado de sala no válido.');
            allowed.status = patch.status;
        }
        Object.assign(room, allowed, { updatedAt: new Date() });
        await room.save();
        return publicRoom(room);
    }

    async remove({ code, userId }) {
        const room = await this.findByCode(code);
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'La sala no existe.', 404);
        if (String(room.ownerId) !== String(userId)) throw new RoomError('ROOM_OWNER_REQUIRED', 'Solo el propietario puede eliminar la sala.', 403);
        await this.roomModel.deleteOne({ _id: room._id });
        return publicRoom(room);
    }
}

module.exports = { RoomService, RoomError, normalizeCode, publicRoom };
