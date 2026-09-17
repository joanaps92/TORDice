const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
    if (!user) return null;
    const id = String(user._id || user.id);
    const displayName = user.displayName || user.username || user.email?.split('@')[0] || '';
    return {
        id,
        email: user.email || '',
        displayName,
        role: user.role || 'user',
        // Compatibilidad con la interfaz histórica de TORDice.
        username: user.username || displayName
    };
}

class AuthService {
    constructor({ userModel, jwtSecret = process.env.JWT_SECRET, jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h' }) {
        if (!userModel) throw new Error('AuthService necesita un modelo de usuario.');
        if (!jwtSecret) throw new Error('JWT_SECRET es obligatorio.');
        this.userModel = userModel;
        this.jwtSecret = jwtSecret;
        this.jwtExpiresIn = jwtExpiresIn;
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 12);
    }

    async verifyPassword(password, passwordHash) {
        if (!password || !passwordHash) return false;
        return bcrypt.compare(password, passwordHash);
    }

    validateRegistration({ email, password, displayName }) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedDisplayName = String(displayName || '').trim();
        const errors = [];
        if (!normalizedEmail || !isValidEmail(normalizedEmail)) errors.push('Introduce un email válido.');
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) errors.push(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        if (!normalizedDisplayName) errors.push('El nombre o alias es obligatorio.');
        return { normalizedEmail, normalizedDisplayName, errors };
    }

    async register({ email, password, displayName }) {
        const validation = this.validateRegistration({ email, password, displayName });
        if (validation.errors.length) {
            const error = new Error(validation.errors.join(' '));
            error.status = 400;
            error.code = 'INVALID_REGISTRATION';
            throw error;
        }

        const existing = await this.userModel.findOne({ email: validation.normalizedEmail });
        if (existing) {
            const error = new Error('El email ya está registrado.');
            error.status = 409;
            error.code = 'EMAIL_ALREADY_REGISTERED';
            throw error;
        }

        const passwordHash = await this.hashPassword(password);
        try {
            const user = await this.userModel.create({
                email: validation.normalizedEmail,
                passwordHash,
                displayName: validation.normalizedDisplayName,
                role: 'user'
            });
            return { user: publicUser(user), accessToken: this.generateAccessToken(user) };
        } catch (error) {
            if (error?.code === 11000) {
                const duplicate = new Error('El email ya está registrado.');
                duplicate.status = 409;
                duplicate.code = 'EMAIL_ALREADY_REGISTERED';
                throw duplicate;
            }
            throw error;
        }
    }

    async login({ email, username, password }) {
        const normalizedEmail = normalizeEmail(email);
        const query = normalizedEmail ? { email: normalizedEmail } : { username: String(username || '').trim() };
        let userQuery = this.userModel.findOne(query);
        if (userQuery && typeof userQuery.select === 'function') userQuery = userQuery.select('+passwordHash');
        const user = await userQuery;
        const storedHash = user?.passwordHash || user?.password;
        const valid = user && await this.verifyPassword(password, storedHash);
        if (!valid) {
            const error = new Error('Credenciales incorrectas.');
            error.status = 401;
            error.code = 'INVALID_CREDENTIALS';
            throw error;
        }

        // Los usuarios antiguos se actualizan de forma transparente al iniciar sesión.
        if (!user.passwordHash && user.password) {
            user.passwordHash = user.password;
            if (!user.displayName) user.displayName = user.username;
            await user.save();
        }
        return { user: publicUser(user), accessToken: this.generateAccessToken(user) };
    }

    generateAccessToken(user) {
        return jwt.sign({ sub: String(user._id || user.id), role: user.role || 'user' }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }

    verifyAccessToken(token) {
        const payload = jwt.verify(token, this.jwtSecret);
        if (!payload?.sub) throw new Error('Token inválido.');
        return payload;
    }

    async getUserById(id) {
        return this.userModel.findById(id);
    }

    serializeUser(user) {
        return publicUser(user);
    }
}

module.exports = { AuthService, normalizeEmail, isValidEmail, publicUser, MIN_PASSWORD_LENGTH };
