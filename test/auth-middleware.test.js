const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateUser, requireRole } = require('../middleware/auth');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('authenticateUser adjunta usuario, rechaza ausencia y token inválido', async () => {
    const service = {
        verifyAccessToken(token) { if (token === 'invalid') throw new Error(); return { sub: 'u1' }; },
        async getUserById(id) { return id === 'u1' ? { _id: id, role: 'user', email: 'u@example.com', displayName: 'User' } : null; }
    };
    const middleware = authenticateUser(service);
    const req = { get: () => 'Bearer valid' };
    const res = response();
    let called = false;
    await middleware(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.deepEqual(req.user, { id: 'u1', role: 'user', email: 'u@example.com', displayName: 'User', username: 'User' });

    const missingRes = response();
    await middleware({ get: () => '' }, missingRes, () => {});
    assert.equal(missingRes.statusCode, 401);

    const invalidRes = response();
    await middleware({ get: () => 'Bearer invalid' }, invalidRes, () => {});
    assert.equal(invalidRes.statusCode, 403);
});

test('requireRole limita admin endpoints', () => {
    const middleware = requireRole('admin');
    const forbidden = response();
    middleware({ user: { role: 'user' } }, forbidden, () => {});
    assert.equal(forbidden.statusCode, 403);
    let called = false;
    middleware({ user: { role: 'admin' } }, response(), () => { called = true; });
    assert.equal(called, true);
});
