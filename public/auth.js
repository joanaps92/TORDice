document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const registerScreen = document.getElementById('register-screen');
    const emailSetupScreen = document.getElementById('email-setup-screen');
    const forgotPasswordScreen = document.getElementById('forgot-password-screen');
    const roomSelectionScreen = document.getElementById('room-selection-screen');
    const appScreen = document.getElementById('app-screen');
    const adminPanelBtn = document.getElementById('admin-panel-btn');

    // Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const emailSetupForm = document.getElementById('email-setup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const createUserForm = document.getElementById('create-user-form');
    const editUserForm = document.getElementById('edit-user-form');
    let adminUsers = [];

    function showScreen(screen) {
        authScreen.classList.add('d-none');
        registerScreen.classList.add('d-none');
        emailSetupScreen.classList.add('d-none');
        forgotPasswordScreen.classList.add('d-none');
        roomSelectionScreen.classList.add('d-none');
        appScreen.classList.add('d-none');
        document.getElementById('adventure-screen').classList.add('d-none');
        document.getElementById('adventurer-screen').classList.add('d-none');
        screen.classList.remove('d-none');
        screen.classList.add('d-flex');
    }

    function getToken() { return window.TokenService.getToken(); }

    async function checkAuth() {
        adminPanelBtn.classList.add('d-none');
        if (!getToken()) return showScreen(window.location.pathname === '/register' ? registerScreen : authScreen);
        try {
            const user = await window.AuthService.refreshCurrentUser();
            if (user.role === 'admin') adminPanelBtn.classList.remove('d-none');
            window.currentUser = user.displayName || user.username;
            const changeUsernameInput = document.getElementById('change-username-input');
            if (changeUsernameInput) {
                changeUsernameInput.value = window.currentUser;
                changeUsernameInput.disabled = true;
                const saveBtn = document.getElementById('save-username-btn');
                if (saveBtn) saveBtn.disabled = true;
            }
            if (window.initSocket) window.initSocket(getToken());
            const linkedRoomCode = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{6})$/)?.[1];
            const linkedRoomInput = document.getElementById('private-room-code');
            if (linkedRoomCode && linkedRoomInput) linkedRoomInput.value = linkedRoomCode.toUpperCase();
            showScreen(roomSelectionScreen);
        } catch (_) {
            showScreen(authScreen);
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identity = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        
        try {
            const data = await window.AuthService.login(identity.includes('@') ? { email: identity, password } : { username: identity, password });
            if (data.needsEmail) showScreen(emailSetupScreen); else await checkAuth();
        } catch (err) {
            appAlert(err.message || 'Error de conexión');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = document.getElementById('register-display-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmation = document.getElementById('register-password-confirm').value;
        if (password !== confirmation) return appAlert('Las contraseñas no coinciden.');
        try {
            await window.AuthService.register({ displayName, email, password });
            await checkAuth();
        } catch (err) {
            appAlert(err.message || 'No se pudo crear la cuenta.');
        }
    });

    document.getElementById('show-register').addEventListener('click', () => { history.pushState({}, '', '/register'); showScreen(registerScreen); });
    document.getElementById('show-login').addEventListener('click', () => { history.pushState({}, '', '/login'); showScreen(authScreen); });

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

            const user = window.AuthService.getCurrentUser();
            user.email = email;
            window.AuthService.setSession({ accessToken: getToken(), user });
            
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
        const identity = document.getElementById('forgot-username').value.trim();
        const btn = forgotPasswordForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity })
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
        const identity = document.getElementById('forgot-username').value.trim();
        const code = document.getElementById('reset-code').value.trim();
        const newPassword = document.getElementById('new-password').value;

        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity, code, newPassword })
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
                        <td>${escapeHtml(u.displayName || u.username)}</td>
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
            <option value="${user._id}" ${selected.has(String(user._id)) ? 'selected' : ''}>${escapeHtml(user.displayName || user.username)}${user.role === 'admin' ? ' (admin)' : ''}</option>
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
                <option value="${user._id}" ${String(ownerId) === String(user._id) ? 'selected' : ''}>${escapeHtml(user.displayName || user.username)}${user.role === 'admin' ? ' (admin)' : ''}</option>
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
        await loadAdventureAdministration();
    }

    const adventureEditor = document.getElementById('adminAdventureEditorModal');
    const adventureEditorModal = adventureEditor ? bootstrap.Modal.getOrCreateInstance(adventureEditor) : null;
    const adventureJsonInput = document.getElementById('admin-adventure-json');
    const adventureValidation = document.getElementById('admin-adventure-validation');
    const adventureSaveButton = document.getElementById('admin-adventure-save-btn');
    const adventureMetadataFields = {
        titulo: document.getElementById('admin-adventure-title'),
        descripcion: document.getElementById('admin-adventure-description'),
        ambientacion: document.getElementById('admin-adventure-setting'),
        duracion: document.getElementById('admin-adventure-duration'),
        dificultad: document.getElementById('admin-adventure-difficulty')
    };
    let adventureValidationPassed = false;

    function adventureApi(path, options = {}) {
        return fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) } });
    }

    function renderAdventureValidation(result) {
        adventureValidation.classList.remove('d-none', 'is-invalid');
        adventureSaveButton.disabled = !result.valid;
        adventureValidationPassed = result.valid;
        if (result.valid) {
            adventureValidation.innerHTML = `<strong><i class="fa-solid fa-circle-check me-1"></i> JSON válido</strong><div>${result.stats.scenes} escenas · ${result.stats.rolls} tiradas · ${result.stats.terminals} finales · Todas las escenas son accesibles</div>`;
            return;
        }
        adventureValidation.classList.add('is-invalid');
        adventureValidation.innerHTML = `<strong><i class="fa-solid fa-circle-exclamation me-1"></i> Hay ${result.errors?.length || 1} errores</strong><ul>${(result.errors || [{ message: 'El JSON no es válido.' }]).map(error => `<li>${escapeHtml(error.message)}${error.path ? ` <small>(${escapeHtml(error.path)})</small>` : ''}</li>`).join('')}</ul>`;
    }

    function syncAdventureMetadataFields(json) {
        Object.entries(adventureMetadataFields).forEach(([field, input]) => { input.value = json?.[field] || ''; });
    }

    function adventureEditorJson() {
        const json = JSON.parse(adventureJsonInput.value);
        Object.entries(adventureMetadataFields).forEach(([field, input]) => { if (input.value.trim()) json[field] = input.value.trim(); });
        return json;
    }

    async function loadAdventureAdministration() {
        const tbody = document.getElementById('admin-adventures-list');
        if (!tbody) return;
        const res = await adventureApi('/api/admin/adventures');
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="5" class="text-danger">No se pudieron cargar las aventuras.</td></tr>'; return; }
        const adventures = await res.json();
        if (!adventures.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Todavía no hay aventuras gestionadas.</td></tr>'; return; }
        tbody.innerHTML = adventures.map(adventure => {
            const published = adventure.status === 'published';
            const date = adventure.updatedAt ? new Date(adventure.updatedAt).toLocaleDateString('es-ES') : '—';
            return `<tr data-adventure-id="${escapeHtml(adventure.id)}"><td><strong>${escapeHtml(adventure.title)}</strong><small class="d-block text-muted">${escapeHtml(adventure.id)}</small></td><td><span class="badge ${published ? 'bg-success' : 'bg-secondary'}">${published ? 'Publicada' : 'Borrador'}</span></td><td>v${escapeHtml(adventure.version)}</td><td>${escapeHtml(date)}</td><td class="text-nowrap"><button class="btn btn-sm btn-outline-dark admin-adventure-preview" title="Previsualizar y jugar"><i class="fa-solid fa-play"></i></button> <button class="btn btn-sm btn-outline-primary admin-adventure-edit" title="Ver o editar JSON"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-sm btn-outline-secondary admin-adventure-download" title="Descargar JSON"><i class="fa-solid fa-download"></i></button> <button class="btn btn-sm ${published ? 'btn-outline-warning admin-adventure-unpublish' : 'btn-outline-success admin-adventure-publish'}">${published ? 'Despublicar' : 'Publicar'}</button> <button class="btn btn-sm btn-outline-danger admin-adventure-delete" title="Eliminar"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        }).join('');
    }

    function openNewAdventureEditor() {
        adventureJsonInput.value = '';
        document.getElementById('admin-adventure-editor-title').textContent = 'NUEVA AVENTURA';
        adventureValidation.classList.add('d-none');
        adventureSaveButton.disabled = true;
        adventureValidationPassed = false;
        adventureEditor.dataset.adventureId = '';
        adventureEditorModal.show();
        adventureApi('/api/admin/adventures/template').then(res => res.json()).then(template => { if (!adventureJsonInput.value) adventureJsonInput.value = JSON.stringify(template, null, 2); syncAdventureMetadataFields(template); });
    }

    async function editAdventure(id) {
        const res = await adventureApi(`/api/admin/adventures/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) return appAlert(data.error || 'No se pudo cargar la aventura.');
        adventureJsonInput.value = JSON.stringify(data.json, null, 2);
        syncAdventureMetadataFields(data.json);
        document.getElementById('admin-adventure-editor-title').textContent = `EDITAR ${String(data.adventure.title || '').toUpperCase()}`;
        adventureValidation.classList.add('d-none');
        adventureSaveButton.disabled = true;
        adventureValidationPassed = false;
        adventureEditor.dataset.adventureId = id;
        adventureEditorModal.show();
    }

    async function previewAdventure(id) {
        const characters = await adventureApi('/api/adventure-characters');
        const availableCharacters = characters.ok ? await characters.json() : [];
        const character = availableCharacters[0];
        if (!character) return appAlert('Necesitas al menos un personaje para iniciar la preview.');
        bootstrap.Modal.getInstance(document.getElementById('adminModal'))?.hide();
        if (window.startAdventurePreview) window.startAdventurePreview(id, character.id);
    }

    document.getElementById('adminModal').addEventListener('show.bs.modal', refreshAdminPanel);
    document.getElementById('admin-new-adventure-btn').addEventListener('click', openNewAdventureEditor);
    document.getElementById('admin-adventures-template-btn').addEventListener('click', async () => {
        const res = await adventureApi('/api/admin/adventures/template');
        const blob = new Blob([JSON.stringify(await res.json(), null, 2)], { type: 'application/json' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'aventura-template-v1.json'; link.click(); URL.revokeObjectURL(link.href);
    });
    document.getElementById('admin-adventure-file').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { adventureJsonInput.value = reader.result; try { syncAdventureMetadataFields(JSON.parse(reader.result)); } catch (_) {} adventureValidation.classList.add('d-none'); adventureSaveButton.disabled = true; adventureValidationPassed = false; };
        reader.readAsText(file);
    });
    adventureJsonInput.addEventListener('input', () => { try { syncAdventureMetadataFields(JSON.parse(adventureJsonInput.value)); } catch (_) {} adventureValidation.classList.add('d-none'); adventureSaveButton.disabled = true; adventureValidationPassed = false; });
    document.getElementById('admin-adventure-validate-btn').addEventListener('click', async () => {
        let json;
        try { json = adventureEditorJson(); } catch (_) { return renderAdventureValidation({ valid: false, errors: [{ message: 'El JSON no es válido.' }] }); }
        const res = await adventureApi('/api/admin/adventures/validate', { method: 'POST', body: JSON.stringify({ json }) });
        renderAdventureValidation(await res.json());
    });
    document.getElementById('admin-adventure-save-btn').addEventListener('click', async () => {
        if (!adventureValidationPassed) return;
        const res = await adventureApi('/api/admin/adventures', { method: 'POST', body: JSON.stringify({ json: adventureEditorJson() }) });
        const data = await res.json();
        if (!res.ok) return renderAdventureValidation(data);
        adventureEditorModal.hide();
        await loadAdventureAdministration();
        appAlert(`Aventura guardada como borrador (v${data.version}).`, 'Aventura guardada');
    });
    document.getElementById('admin-adventures-list').addEventListener('click', async event => {
        const row = event.target.closest('tr[data-adventure-id]');
        if (!row) return;
        const id = row.dataset.adventureId;
        if (event.target.closest('.admin-adventure-preview')) return previewAdventure(id);
        if (event.target.closest('.admin-adventure-edit')) return editAdventure(id);
        if (event.target.closest('.admin-adventure-download')) {
            const download = await adventureApi(`/api/admin/adventures/${encodeURIComponent(id)}/json`);
            if (!download.ok) return appAlert('No se pudo descargar la aventura.');
            const blob = await download.blob();
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${id}.json`; link.click(); URL.revokeObjectURL(link.href);
            return;
        }
        const action = event.target.closest('.admin-adventure-publish, .admin-adventure-unpublish');
        if (action) { await adventureApi(`/api/admin/adventures/${encodeURIComponent(id)}/${action.classList.contains('admin-adventure-publish') ? 'publish' : 'unpublish'}`, { method: 'POST' }); await loadAdventureAdministration(); return; }
        if (event.target.closest('.admin-adventure-delete') && await appConfirm('Esta acción eliminará todas las versiones guardadas. ¿Continuar?', 'Eliminar aventura')) { await adventureApi(`/api/admin/adventures/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadAdventureAdministration(); }
    });

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

    function logout() {
        window.AuthService.logout();
        window.currentUser = '';
        history.pushState({}, '', '/login');
        showScreen(authScreen);
    }
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('app-logout-btn').addEventListener('click', logout);

    // Start with the auth check in auth.js instead of loading roomSelectionScreen directly.
    checkAuth();
});
