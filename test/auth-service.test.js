const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../services/auth-service');

function createUserModel() {
    const users = [];
    return {
        users,
        async findOne(query) {
            return users.find(user => Object.entries(query).every(([key, value]) => user[key] === value)) || null;
        },
        async create(value) {
            const user = { ...value, _id: `user-${users.length + 1}`, async save() {} };
            users.push(user);
            return user;
        },
        async findById(id) { return users.find(user => user._id === id) || null; }
    };
}

test('registra un usuario con email normalizado y nunca expone el hash', async () => {
    const model = createUserModel();
    const service = new AuthService({ userModel: model, jwtSecret: 'test-secret' });
    const result = await service.register({ email: '  Panda@Example.COM ', password: 'secreto-largo', displayName: 'Panda' });

    assert.equal(model.users[0].email, 'panda@example.com');
    assert.equal(model.users[0].passwordHash !== 'secreto-largo', true);
    assert.equal(result.user.email, 'panda@example.com');
    assert.equal('passwordHash' in result.user, false);
    assert.equal(service.verifyAccessToken(result.accessToken).sub, model.users[0]._id);
});

test('rechaza registro inválido y email duplicado', async () => {
    const model = createUserModel();
    const service = new AuthService({ userModel: model, jwtSecret: 'test-secret' });
    await assert.rejects(() => service.register({ email: 'no-es-email', password: 'corta', displayName: '' }), /email válido/);
    await service.register({ email: 'user@example.com', password: 'secreto-largo', displayName: 'User' });
    await assert.rejects(() => service.register({ email: 'USER@example.com', password: 'secreto-largo', displayName: 'Other' }), error => error.code === 'EMAIL_ALREADY_REGISTERED' && error.status === 409);
});

test('login correcto, contraseña incorrecta y usuario inexistente', async () => {
    const model = createUserModel();
    const service = new AuthService({ userModel: model, jwtSecret: 'test-secret' });
    await service.register({ email: 'user@example.com', password: 'secreto-largo', displayName: 'User' });
    const result = await service.login({ email: 'USER@example.com', password: 'secreto-largo' });
    assert.equal(result.user.displayName, 'User');
    await assert.rejects(() => service.login({ email: 'user@example.com', password: 'incorrecta' }), error => error.code === 'INVALID_CREDENTIALS' && error.status === 401);
    await assert.rejects(() => service.login({ email: 'missing@example.com', password: 'secreto-largo' }), error => error.code === 'INVALID_CREDENTIALS' && error.status === 401);
});
