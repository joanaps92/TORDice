const isLocalFile = window.location.protocol === 'file:';

// Initialize socket with error handling
let socket;
if (isLocalFile) {
    socket = { on: () => {}, emit: () => {}, connected: false };
} else {
    try {
        socket = io();
    } catch (e) {
        console.error("Error al inicializar Socket.io:", e);
        socket = { on: () => {}, emit: () => {}, connected: false };
    }
}

// Mock persistence for local testing
const getLocalHistory = (room) => JSON.parse(localStorage.getItem(`rpg_history_${room}`) || '[]');
const saveLocalHistory = (room, roll) => {
    const history = getLocalHistory(room);
    history.push(roll);
    if (history.length > 50) history.shift();
    localStorage.setItem(`rpg_history_${room}`, JSON.stringify(history));
};

// State
let currentUser = "";
let currentRoom = "";

// Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const roomnameInput = document.getElementById('roomname');
const userDisplay = document.getElementById('user-display');
const roomDisplay = document.getElementById('room-display');

const d12Range = document.getElementById('d12-range');
const d6Range = document.getElementById('d6-range');
const d12Val = document.getElementById('d12-val');
const d6Val = document.getElementById('d6-val');
const rollBtn = document.getElementById('roll-btn');
const historyList = document.getElementById('history-list');
const roomList = document.getElementById('room-list');
const roomListContainer = document.getElementById('room-list-container');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const leaveBtn = document.getElementById('leave-btn');
const activeUsersList = document.getElementById('active-users-list');

// UI Handlers
d12Range.addEventListener('input', (e) => {
    d12Val.textContent = e.target.value;
});

d6Range.addEventListener('input', (e) => {
    d6Val.textContent = e.target.value;
});

// Join Room
joinBtn.addEventListener('click', () => {
    const user = usernameInput.value.trim();
    const room = roomnameInput.value.trim();

    if (!user || !room) {
        alert("Por favor, introduce tu nombre y el nombre de la sala.");
        return;
    }

    currentUser = user;
    currentRoom = room;

    userDisplay.innerHTML = `<i class="fa-solid fa-user me-1"></i> ${currentUser}`;
    roomDisplay.innerHTML = `<i class="fa-solid fa-fort-awesome me-1"></i> Sala: ${currentRoom}`;

    if (isLocalFile) {
        // Mock join-room logic
        const history = getLocalHistory(currentRoom);
        historyList.innerHTML = "";
        if (history.length === 0) renderEmptyMessage();
        else history.forEach(roll => addRollToUI(roll, false));
        scrollToBottom();
    } else {
        socket.emit('join-room', { roomName: currentRoom, username: currentUser });
    }

    loginScreen.classList.add('d-none');
    appScreen.classList.remove('d-none');
});

// Roll Dice
rollBtn.addEventListener('click', () => {
    const d12Count = parseInt(d12Range.value);
    const d6Count = parseInt(d6Range.value);

    if (d12Count === 0 && d6Count === 0) {
        alert("¡Selecciona al menos un dado para lanzar!");
        return;
    }

    const rollData = {
        room: currentRoom,
        user: currentUser,
        d12Count,
        d6Count
    };

    if (isLocalFile) {
        // Mock roll logic
        const d12Results = Array.from({ length: d12Count }, () => Math.floor(Math.random() * 12) + 1);
        const d6Results = Array.from({ length: d6Count }, () => Math.floor(Math.random() * 6) + 1);
        const total = [...d12Results, ...d6Results].reduce((a, b) => a + b, 0);
        const rollEntry = {
            id: Date.now(),
            user: currentUser,
            d12Results,
            d6Results,
            total,
            timestamp: new Date().toLocaleTimeString()
        };
        saveLocalHistory(currentRoom, rollEntry);
        // Remove empty message if present
        const emptyMsg = document.querySelector('.empty-msg');
        if (emptyMsg) emptyMsg.remove();
        addRollToUI(rollEntry, true);
        scrollToBottom();
    } else {
        socket.emit('roll-dice', rollData);
    }

    // Reset ranges after roll
    d12Range.value = 0;
    d6Range.value = 0;
    d12Val.textContent = "0";
    d6Val.textContent = "0";
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres borrar todo el historial de esta sala?")) {
        if (isLocalFile) {
            localStorage.setItem(`rpg_history_${currentRoom}`, JSON.stringify([]));
            historyList.innerHTML = "";
            renderEmptyMessage();
        } else {
            socket.emit('clear-history', currentRoom);
        }
    }
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres salir de la sala?")) {
        if (!isLocalFile) {
            // Socket.io handles room leaving on disconnect or we can emit an event
            // For simplicity and to reset all state, we'll reload
            window.location.reload();
        } else {
            loginScreen.classList.remove('d-none');
            appScreen.classList.add('d-none');
            currentUser = "";
            currentRoom = "";
        }
    }
});

// Socket Events
socket.on('load-history', (history) => {
    historyList.innerHTML = "";
    if (history.length === 0) {
        renderEmptyMessage();
    } else {
        history.forEach(roll => addRollToUI(roll, false));
        scrollToBottom();
    }
});

socket.on('new-roll', (roll) => {
    // Remove empty message if present
    const emptyMsg = document.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    addRollToUI(roll, true);
    scrollToBottom();
});

socket.on('connect', () => {
    console.log("Conectado al servidor de dados");
});

socket.on('connect_error', (err) => {
    console.error("Error de conexión:", err.message);
});

socket.on('disconnect', () => {
    console.warn("Desconectado del servidor");
});

socket.on('update-room-users', (users) => {
    activeUsersList.innerHTML = "";
    users.forEach(user => {
        const badge = document.createElement('span');
        badge.className = "badge bg-gold px-3 py-2";
        badge.innerHTML = `<i class="fa-solid fa-user-shield me-1"></i> ${user}`;
        if (user === currentUser) {
            badge.classList.remove('bg-gold');
            badge.classList.add('bg-purple');
            badge.innerHTML += " (Tú)";
        }
        activeUsersList.appendChild(badge);
    });
});

socket.on('room-deleted', () => {
    alert("Esta sala ha sido eliminada por un administrador.");
    window.location.reload();
});

socket.on('update-rooms', (rooms) => {
    if (rooms.length === 0) {
        roomListContainer.classList.add('d-none');
        return;
    }

    roomListContainer.classList.remove('d-none');
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = "list-group-item list-group-item-action room-item d-flex justify-content-between align-items-center py-2 px-3";
        
        const nameSpan = document.createElement('span');
        nameSpan.className = "flex-grow-1 cursor-pointer py-2";
        nameSpan.innerHTML = `<i class="fa-solid fa-door-open me-2 text-gold"></i> ${room}`;
        nameSpan.onclick = () => {
            roomnameInput.value = room;
            joinBtn.click();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "btn btn-link text-danger p-2 opacity-50 hover-opacity-100";
        deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar la sala "${room}" y todo su historial?`)) {
                if (isLocalFile) {
                    localStorage.removeItem(`rpg_history_${room}`);
                    // En modo local no tenemos forma de actualizar la lista fácilmente sin un "server" simulado más complejo
                    item.remove();
                    if (roomList.children.length === 0) roomListContainer.classList.add('d-none');
                } else {
                    socket.emit('delete-room', room);
                }
            }
        };

        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        roomList.appendChild(item);
    });
});

function addRollToUI(roll, isNew) {
    const card = document.createElement('div');
    card.className = `roll-card p-3 ${isNew ? 'animate-slide-in' : ''}`;

    const d12Results = roll.d12Results || [];
    const d6Results = roll.d6Results || [];
    
    const d6Total = d6Results.reduce((a, b) => a + b, 0);
    const getD12SortValue = (v) => v === 11 ? -1 : (v === 12 ? 13 : v);
    
    let maxD12 = null;
    let minD12 = null;
    
    if (d12Results.length > 0) {
        maxD12 = d12Results.reduce((a, b) => getD12SortValue(a) > getD12SortValue(b) ? a : b);
        minD12 = d12Results.reduce((a, b) => getD12SortValue(a) < getD12SortValue(b) ? a : b);
    }

    const renderD12 = (val) => {
        if (val === 11) return `<img src="eye_of_sauron.png" class="dice-icon" title="Ojo de Sauron (Mínimo)">`;
        if (val === 12) return `<img src="gandalf_rune.png" class="dice-icon" title="Runa de Gandalf (Máximo)">`;
        return `<span class="dice-badge">${val}</span>`;
    };

    const d12Str = d12Results.length > 0 
        ? `<div class="mb-2"><span class="text-muted small fw-bold">D12:</span> ${d12Results.map(r => `<span class="me-1 d-inline-block">${renderD12(r)}</span>`).join('')}</div>` 
        : '';
        
    const d6Str = d6Results.length > 0 
        ? `<div class="mb-2"><span class="text-muted small fw-bold">D6:</span> ${d6Results.map(r => `<span class="dice-badge me-1">${r}</span>`).join('')}</div>` 
        : '';

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="fw-bold text-dark mb-1">${roll.user} <span class="text-muted fw-normal ms-2" style="font-size: 0.75rem;">${roll.timestamp}</span></div>
                ${d12Str}
                ${d6Str}
            </div>
            <div class="total-badge-container">
                ${d12Results.length === 1 ? `
                    <div class="total-badge">
                        <span class="total-val">${renderD12(d12Results[0])}</span>
                        <span class="total-label">D12</span>
                    </div>
                ` : ''}
                ${d12Results.length > 1 ? `
                    <div class="total-badge border-success">
                        <span class="total-val text-success">${renderD12(maxD12)}</span>
                        <span class="total-label">MAX D12</span>
                    </div>
                    <div class="total-badge border-danger">
                        <span class="total-val text-danger">${renderD12(minD12)}</span>
                        <span class="total-label">MIN D12</span>
                    </div>
                ` : ''}
                ${d6Results.length > 0 ? `
                    <div class="total-badge">
                        <span class="total-val">${d6Total}</span>
                        <span class="total-label">TOTAL D6</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    historyList.appendChild(card);
}

function renderEmptyMessage() {
    historyList.innerHTML = `
        <div class="text-center text-muted mt-5 py-5 empty-msg">
            <i class="fa-solid fa-ghost fa-3x mb-3 d-block"></i>
            <p>No hay tiradas aún... ¡Sé el primero!</p>
        </div>
    `;
}

function scrollToBottom() {
    historyList.scrollTop = historyList.scrollHeight;
}
