// Detect if running locally without a server
const isLocalFile = window.location.protocol === 'file:';
const socket = isLocalFile ? { on: () => {}, emit: () => {} } : io();

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
        socket.emit('join-room', currentRoom);
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

socket.on('update-rooms', (rooms) => {
    if (rooms.length === 0) {
        roomListContainer.classList.add('d-none');
        return;
    }

    roomListContainer.classList.remove('d-none');
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const item = document.createElement('a');
        item.className = "list-group-item list-group-item-action room-item d-flex justify-content-between align-items-center py-3";
        item.innerHTML = `
            <span><i class="fa-solid fa-door-open me-2 text-gold"></i> ${room}</span>
            <i class="fa-solid fa-chevron-right small opacity-50"></i>
        `;
        item.onclick = () => {
            roomnameInput.value = room;
            joinBtn.click();
        };
        roomList.appendChild(item);
    });
});

function addRollToUI(roll, isNew) {
    const card = document.createElement('div');
    card.className = `roll-card p-3 ${isNew ? 'animate-slide-in' : ''}`;

    const d12Results = roll.d12Results || [];
    const d6Results = roll.d6Results || [];
    
    const d12Total = d12Results.reduce((a, b) => a + b, 0);
    const d6Total = d6Results.reduce((a, b) => a + b, 0);

    const d12Str = d12Results.length > 0 
        ? `<div class="mb-2"><span class="text-muted small fw-bold">D12:</span> ${d12Results.map(r => `<span class="dice-badge me-1">${r}</span>`).join('')}</div>` 
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
                ${d12Results.length > 0 ? `
                    <div class="total-badge">
                        <span class="total-val">${d12Total}</span>
                        <span class="total-label">D12</span>
                    </div>
                ` : ''}
                ${d6Results.length > 0 ? `
                    <div class="total-badge">
                        <span class="total-val">${d6Total}</span>
                        <span class="total-label">D6</span>
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
