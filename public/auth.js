document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const emailSetupScreen = document.getElementById('email-setup-screen');
    const forgotPasswordScreen = document.getElementById('forgot-password-screen');
    const roomSelectionScreen = document.getElementById('room-selection-screen');
    const appScreen = document.getElementById('app-screen');
    const adminPanelBtn = document.getElementById('admin-panel-btn');

    // Forms
    const loginForm = document.getElementById('login-form');
    const emailSetupForm = document.getElementById('email-setup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const createUserForm = document.getElementById('create-user-form');
    const editUserForm = document.getElementById('edit-user-form');
    let adminUsers = [];

    function showScreen(screen) {
        authScreen.classList.add('d-none');
        emailSetupScreen.classList.add('d-none');
        forgotPasswordScreen.classList.add('d-none');
        roomSelectionScreen.classList.add('d-none');
        appScreen.classList.add('d-none');
        document.getElementById('adventure-screen').classList.add('d-none');
        document.getElementById('adventurer-screen').classList.add('d-none');
        screen.classList.remove('d-none');
        screen.classList.add('d-flex');
    }

    function getToken() {
        return localStorage.getItem('rpg_auth_token');
    }

    function checkAuth() {
        const token = getToken();
        if (token) {
            const userStr = localStorage.getItem('rpg_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.role === 'admin') {
                    adminPanelBtn.classList.remove('d-none');
                }
                
                // Set currentUser for client.js compatibility
                window.currentUser = user.username;
                const changeUsernameInput = document.getElementById('change-username-input');
                if (changeUsernameInput) {
                    changeUsernameInput.value = user.username;
                    changeUsernameInput.disabled = true;
                    const saveBtn = document.getElementById('save-username-btn');
                    if (saveBtn) saveBtn.disabled = true;
                }
                
                // Init socket
                if (window.initSocket) window.initSocket(token);
                
                showScreen(roomSelectionScreen);
                return;
            }
        }
        showScreen(authScreen);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (!res.ok) {
                appAlert(data.error);
                return;
            }

            localStorage.setItem('rpg_auth_token', data.token);
            localStorage.setItem('rpg_user', JSON.stringify(data.user));

            if (data.needsEmail) {
                showScreen(emailSetupScreen);
            } else {
                checkAuth();
            }
        } catch (err) {
                appAlert("Error de conexión");
        }
    });

    emailSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('setup-email').value.trim();
        
        try {
            const res = await fetch('/api/setup-email', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}` 
                },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (!res.ok) {
                appAlert(data.error);
                return;
            }

            const user = JSON.parse(localStorage.getItem('rpg_user'));
            user.email = email;
            localStorage.setItem('rpg_user', JSON.stringify(user));
            
            checkAuth();
        } catch (err) {
                appAlert("Error de conexión");
        }
    });

    document.getElementById('show-forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(forgotPasswordScreen);
    });

    document.getElementById('cancel-forgot').addEventListener('click', () => {
        showScreen(authScreen);
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('forgot-username').value.trim();
        const btn = forgotPasswordForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            
            if (!res.ok) {
                appAlert(data.error);
                btn.disabled = false;
                btn.textContent = 'ENVIAR CÓDIGO';
                return;
            }

            document.getElementById('forgot-step-1').classList.add('d-none');
            document.getElementById('forgot-step-2').classList.remove('d-none');
        } catch (err) {
                appAlert("Error de conexión");
            btn.disabled = false;
            btn.textContent = 'ENVIAR CÓDIGO';
        }
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('forgot-username').value.trim();
        const code = document.getElementById('reset-code').value.trim();
        const newPassword = document.getElementById('new-password').value;

        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code, newPassword })
            });
            const data = await res.json();
            
            if (!res.ok) {
                appAlert(data.error);
                return;
            }

                appAlert("Contraseña restablecida con éxito. Ya puedes iniciar sesión.", "Contraseña actualizada");
            document.getElementById('forgot-step-1').classList.remove('d-none');
            document.getElementById('forgot-step-2').classList.add('d-none');
            showScreen(authScreen);
        } catch (err) {
                appAlert("Error de conexión");
        }
    });

    // Admin Functions
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    async function loadUsers() {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) {
            const users = await res.json();
            adminUsers = users;
            const tbody = document.getElementById('admin-users-list');
            tbody.innerHTML = '';
            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(u.username)}</td>
                        <td>${escapeHtml(u.role)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-user-btn" data-id="${u._id}" data-username="${escapeHtml(u.username)}" data-role="${escapeHtml(u.role)}">Editar</button>
                        </td>
                    </tr>
                `;
            });

            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const role = e.target.dataset.role;
                    document.getElementById('edit-user-id').value = id;
                    document.getElementById('edit-user-role').value = role;
                    new bootstrap.Modal(document.getElementById('editUserModal')).show();
                });
            });
        }
    }

    function renderVisibilityUsers(select, selectedIds) {
        const selected = new Set((selectedIds || []).map(String));
        select.innerHTML = adminUsers.map(user => `
            <option value="${user._id}" ${selected.has(String(user._id)) ? 'selected' : ''}>${escapeHtml(user.username)}${user.role === 'admin' ? ' (admin)' : ''}</option>
        `).join('');
    }

    function updateVisibilityUsersState(row) {
        const visibility = row.querySelector('.admin-sheet-visibility').value;
        const usersSelect = row.querySelector('.admin-sheet-users');
        usersSelect.disabled = visibility !== 'selected';
    }

    async function loadAdventurerVisibility() {
        const tbody = document.getElementById('admin-adventurers-list');
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Cargando hojas…</td></tr>';
        const res = await fetch('/api/admin/adventurers', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(data.error || 'No se pudieron cargar las hojas.')}</td></tr>`;
            return;
        }

        const adventurers = await res.json();
        if (!adventurers.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Todavía no hay hojas guardadas.</td></tr>';
            return;
        }

        tbody.innerHTML = adventurers.map(adventurer => {
            const visibility = adventurer.visibility || 'private';
            const ownerId = adventurer.ownerId?._id || adventurer.ownerId || '';
            const ownerOptions = '<option value="">Sin propietario</option>' + adminUsers.map(user => `
                <option value="${user._id}" ${String(ownerId) === String(user._id) ? 'selected' : ''}>${escapeHtml(user.username)}${user.role === 'admin' ? ' (admin)' : ''}</option>
            `).join('');
            return `
                <tr data-adventurer-id="${adventurer._id}">
                    <td><strong>${escapeHtml(adventurer.nombre)}</strong><small class="d-block text-muted">${adventurer.ownerId ? 'Hoja asignada' : 'Sin propietario (hoja antigua)'}</small></td>
                    <td><select class="form-select form-select-sm tor-select admin-sheet-owner">${ownerOptions}</select></td>
                    <td>
                        <select class="form-select form-select-sm tor-select admin-sheet-visibility">
                            <option value="private" ${visibility === 'private' ? 'selected' : ''}>Solo propietario</option>
                            <option value="selected" ${visibility === 'selected' ? 'selected' : ''}>Usuarios seleccionados</option>
                            <option value="all" ${visibility === 'all' ? 'selected' : ''}>Todos los usuarios</option>
                        </select>
                    </td>
                    <td><select class="form-select form-select-sm tor-select admin-sheet-users" multiple size="3" aria-label="Usuarios autorizados"></select></td>
                    <td><button type="button" class="btn btn-sm btn-tor-primary admin-save-visibility">Guardar</button></td>
                </tr>
            `;
        }).join('');

        adventurers.forEach(adventurer => {
            const row = tbody.querySelector(`tr[data-adventurer-id="${adventurer._id}"]`);
            if (!row) return;
            renderVisibilityUsers(row.querySelector('.admin-sheet-users'), (adventurer.visibleTo || []).map(user => user._id || user));
            updateVisibilityUsersState(row);
        });
    }

    async function refreshAdminPanel() {
        await loadUsers();
        await loadAdventurerVisibility();
    }

    document.getElementById('adminModal').addEventListener('show.bs.modal', refreshAdminPanel);

    document.getElementById('admin-adventurers-list').addEventListener('change', (event) => {
        const row = event.target.closest('tr[data-adventurer-id]');
        if (row && event.target.classList.contains('admin-sheet-visibility')) updateVisibilityUsersState(row);
    });

    document.getElementById('admin-adventurers-list').addEventListener('click', async (event) => {
        const button = event.target.closest('.admin-save-visibility');
        if (!button) return;
        const row = button.closest('tr[data-adventurer-id]');
        const visibility = row.querySelector('.admin-sheet-visibility').value;
        const visibleTo = [...row.querySelector('.admin-sheet-users').selectedOptions].map(option => option.value);
        button.disabled = true;
        try {
            const res = await fetch(`/api/admin/adventurers/${row.dataset.adventurerId}/visibility`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({
                    ownerId: row.querySelector('.admin-sheet-owner').value || null,
                    visibility,
                    visibleTo
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar la visibilidad.');
            button.textContent = 'Guardado';
            setTimeout(() => { button.textContent = 'Guardar'; }, 1500);
        } catch (error) {
            appAlert(error.message);
        } finally {
            button.disabled = false;
        }
    });

    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ username, password, role })
        });
        
        if (res.ok) {
            appAlert("Usuario creado", "Usuario creado");
            createUserForm.reset();
            refreshAdminPanel();
        } else {
            const data = await res.json();
            appAlert(data.error);
        }
    });

    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const password = document.getElementById('edit-user-password').value;
        const role = document.getElementById('edit-user-role').value;

        const body = { role };
        if (password) body.password = password;

        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            appAlert("Usuario actualizado", "Usuario actualizado");
            editUserForm.reset();
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            refreshAdminPanel();
        } else {
            const data = await res.json();
            appAlert(data.error);
        }
    });

    // Start with the auth check in auth.js instead of loading roomSelectionScreen directly.
    // Client.js normally did things on load, but we wait for checkAuth().
});
