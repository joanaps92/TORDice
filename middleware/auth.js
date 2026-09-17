function authenticateUser(authService) {
    return async (req, res, next) => {
        const header = req.get('authorization') || '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match) return res.status(401).json({ error: 'Autenticación requerida.' });

        try {
            const payload = authService.verifyAccessToken(match[1]);
            const user = await authService.getUserById(payload.sub);
            if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });
            req.user = {
                id: String(user._id),
                role: user.role || 'user',
                email: user.email || '',
                displayName: user.displayName || user.username || '',
                username: user.username || user.displayName || ''
            };
            next();
        } catch (error) {
            return res.status(403).json({ error: 'Token inválido.' });
        }
    };
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Requiere permisos de administrador.' });
        }
        next();
    };
}

module.exports = { authenticateUser, requireRole };
