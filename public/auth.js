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

    function showScreen(screen) {
        authScreen.classList.add('d-none');
        emailSetupScreen.classList.add('d-none');
        forgotPasswordScreen.classList.add('d-none');
        roomSelectionScreen.classList.add('d-none');
        appScreen.classList.add('d-none');
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
                alert(data.error);
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
            alert("Error de conexión");
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
                alert(data.error);
                return;
            }

            const user = JSON.parse(localStorage.getItem('rpg_user'));
            user.email = email;
            localStorage.setItem('rpg_user', JSON.stringify(user));
            
            checkAuth();
        } catch (err) {
            alert("Error de conexión");
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
                alert(data.error);
                btn.disabled = false;
                btn.textContent = 'ENVIAR CÓDIGO';
                return;
            }

            document.getElementById('forgot-step-1').classList.add('d-none');
            document.getElementById('forgot-step-2').classList.remove('d-none');
        } catch (err) {
            alert("Error de conexión");
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
                alert(data.error);
                return;
            }

            alert("Contraseña restablecida con éxito. Ya puedes iniciar sesión.");
            document.getElementById('forgot-step-1').classList.remove('d-none');
            document.getElementById('forgot-step-2').classList.add('d-none');
            showScreen(authScreen);
        } catch (err) {
            alert("Error de conexión");
        }
    });

    // Admin Functions
    async function loadUsers() {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) {
            const users = await res.json();
            const tbody = document.getElementById('admin-users-list');
            tbody.innerHTML = '';
            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td>${u.username}</td>
                        <td>${u.role}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-user-btn" data-id="${u._id}" data-username="${u.username}" data-role="${u.role}">Editar</button>
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

    document.getElementById('adminModal').addEventListener('show.bs.modal', loadUsers);

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
            alert("Usuario creado");
            createUserForm.reset();
            loadUsers();
        } else {
            const data = await res.json();
            alert(data.error);
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
            alert("Usuario actualizado");
            editUserForm.reset();
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            loadUsers();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    });

    // Start with the auth check in auth.js instead of loading roomSelectionScreen directly.
    // Client.js normally did things on load, but we wait for checkAuth().
});
