const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomService, RoomError } = require('../services/room-service');

function createRoomModel() {
    const rooms = [];
    return {
        rooms,
        async exists(query) { return rooms.some(room => room.code === query.code); },
        async create(value) {
            const room = {
                ...value,
                _id: `room-${rooms.length + 1}`,
                async save() {}
            };
            rooms.push(room);
            return room;
        },
        findOne(query) {
            const room = rooms.find(item => item.code === query.code) || null;
            return { select: async () => room, then: (resolve, reject) => Promise.resolve(room).then(resolve, reject) };
        },
        async deleteOne() {}
    };
}

test('crea salas privadas con código, hash y miembro propietario', async () => {
    const model = createRoomModel();
    const service = new RoomService({
        roomModel: model,
        hashPassword: async password => `hash:${password}`,
        randomBytes: () => Buffer.from([0, 1, 2, 3, 4, 5])
    });
    const room = await service.create({ name: 'Partida del viernes', password: 'moria123', ownerId: 'user-1' });

    assert.equal(room.code.length, 6);
    assert.equal(model.rooms[0].passwordHash, 'hash:moria123');
    assert.deepEqual(model.rooms[0].members[0].userId, 'user-1');
    assert.equal('passwordHash' in room, false);
});

test('solo permite entrar con la contraseña y respeta el límite', async () => {
    const model = createRoomModel();
    const service = new RoomService({
        roomModel: model,
        hashPassword: async password => password,
        comparePassword: async (password, hash) => password === hash,
        randomBytes: () => Buffer.from([0, 1, 2, 3, 4, 5])
    });
    await service.create({ name: 'Sala', password: 'moria123', maxMembers: 2, ownerId: 'owner' });
    await assert.rejects(() => service.join({ code: 'ABCDEF', password: 'incorrecta', userId: 'player-1' }), error => error.code === 'ROOM_INVALID_PASSWORD' && error.status === 401);
    const joined = await service.join({ code: 'ABCDEF', password: 'moria123', userId: 'player-1' });
    assert.equal(joined.members.length, 2);
    await assert.rejects(() => service.join({ code: 'ABCDEF', password: 'moria123', userId: 'player-2' }), error => error.code === 'ROOM_FULL');
});

test('deniega la lectura de una sala a usuarios que no son miembros', async () => {
    const model = createRoomModel();
    const service = new RoomService({ roomModel: model, hashPassword: async password => password, randomBytes: () => Buffer.from([0, 1, 2, 3, 4, 5]) });
    await service.create({ name: 'Sala', password: 'moria123', ownerId: 'owner' });
    await assert.rejects(() => service.getMemberRoom({ code: 'ABCDEF', userId: 'outsider' }), error => error instanceof RoomError && error.code === 'ROOM_ACCESS_DENIED');
});
