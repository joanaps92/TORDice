(function () {
    const TOKEN_KEY = 'rpg_auth_token';
    const USER_KEY = 'rpg_user';
    const listeners = new Set();

    const TokenService = {
        getToken: () => localStorage.getItem(TOKEN_KEY),
        setToken: token => localStorage.setItem(TOKEN_KEY, token),
        clear: () => localStorage.removeItem(TOKEN_KEY)
    };

    function getCachedUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
        catch (_) { return null; }
    }

    function notify(user) { listeners.forEach(listener => listener(user)); }

    const AuthService = {
        TokenService,
        getToken: TokenService.getToken,
        getCurrentUser: getCachedUser,
        isAuthenticated: () => Boolean(TokenService.getToken()),
        onUserChanged: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        setSession({ accessToken, token, user }) {
            TokenService.setToken(accessToken || token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            notify(user);
        },
        clearSession() {
            TokenService.clear();
            localStorage.removeItem(USER_KEY);
            notify(null);
        },
        async request(path, options = {}) {
            const response = await fetch(path, {
                ...options,
                headers: {
                    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                    ...(options.headers || {}),
                    ...(TokenService.getToken() ? { Authorization: `Bearer ${TokenService.getToken()}` } : {})
                }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
            return data;
        },
        async login(credentials) {
            const result = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
            this.setSession(result);
            return result;
        },
        async register(credentials) {
            const result = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
            this.setSession(result);
            return result;
        },
        async refreshCurrentUser() {
            if (!TokenService.getToken()) return null;
            try {
                const user = await this.request('/api/auth/me');
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                notify(user);
                return user;
            } catch (error) {
                this.clearSession();
                throw error;
            }
        },
        logout() { this.clearSession(); }
    };

    window.TokenService = TokenService;
    window.AuthService = AuthService;
})();
