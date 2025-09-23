document.addEventListener('DOMContentLoaded', () => {
    const chatFab = document.getElementById('chatFab');
    const chatWidget = document.getElementById('chat-widget');
    const closeBtn = document.getElementById('chat-close-btn');
    const userList = document.getElementById('chat-user-list');
    const chatHeader = document.getElementById('chat-conversation-header');
    const messagesBox = document.getElementById('chat-messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const inputArea = document.getElementById('chat-input-area');
    const notificationDot = document.getElementById('notification-dot');

    let socket = null;
    let selectedUserId = null;
    let isChatInitialized = false;
    let unreadMessages = {}; // { userId: count }

    // --- FUNCIONES ---
    const toggleChatWidget = () => {
        chatWidget.classList.toggle('hidden');
        if (!chatWidget.classList.contains('hidden') && !isChatInitialized) {
            initChat();
        }
        if (!chatWidget.classList.contains('hidden')) hideNotification();
    };

    const initChat = async () => {
        isChatInitialized = true;
        socket = io();

        try {
            const response = await fetch('/chat/users');
            const users = await response.json();
            userList.innerHTML = '';
            if (users.length === 0) {
                userList.innerHTML = '<div class="p-3 text-center text-muted">No hay otros usuarios para chatear.</div>';
            } else {
                renderUsers(users);
                await checkUnreadMessages(); // Inicializa contadores al cargar
            }
        } catch (err) {
            console.error(err);
            userList.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar usuarios.</div>';
        }

        // --- ESCUCHAR MENSAJES EN TIEMPO REAL ---
        socket.on('private message', (msg) => {
            if (msg.from == selectedUserId) {
                appendMessage(msg.content, 'received');
                markAsRead(msg.from);
            } else {
                addUnreadMessage(msg.from);
                updateUserNotification(msg.from);
                updateGlobalNotification();
            }
        });

        // Mensajes pendientes al iniciar sesión
        socket.on('unread messages', (data) => {
            if (data.unreadMessages) {
                unreadMessages = data.unreadMessages;
                updateAllUserNotifications();
            }
        });
    };

    const renderUsers = (users) => {
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-item p-3 position-relative';
            div.dataset.userid = user.id;

            const count = unreadMessages[user.id] || 0;
            div.innerHTML = `
                <strong>${user.username}</strong>
                <small class="text-muted d-block">${user.rol}</small>
                ${count > 0 ? `<span class="user-notification-dot">${count}</span>` : ''}
            `;
            div.addEventListener('click', () => selectUser(user));
            userList.appendChild(div);
        });
    };

    const selectUser = async (user) => {
        selectedUserId = user.id;
        document.querySelectorAll('.user-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.user-item[data-userid="${user.id}"]`)?.classList.add('active');

        chatHeader.textContent = `Conversación con ${user.username}`;
        inputArea.classList.remove('hidden');
        messagesBox.innerHTML = '<div class="p-3 text-center text-muted">Cargando mensajes...</div>';

        try {
            const response = await fetch(`/chat/history/${user.id}`);
            const history = await response.json();
            messagesBox.innerHTML = '';
            history.forEach(msg => appendMessage(msg.contenido, msg.de_usuario_id === currentUserId ? 'sent' : 'received'));
            markAsRead(user.id);
        } catch (err) {
            console.error(err);
            messagesBox.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar mensajes.</div>';
        }
    };

    const appendMessage = (content, type) => {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.textContent = content;
        messagesBox.appendChild(msg);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    };

    const addUnreadMessage = (userId) => {
        unreadMessages[userId] = (unreadMessages[userId] || 0) + 1;
    };

    const markAsRead = async (userId) => {
        if (unreadMessages[userId]) delete unreadMessages[userId];
        updateUserNotification(userId);
        updateGlobalNotification();

        await fetch(`/chat/mark-read/${userId}`, { method: 'POST' }).catch(console.error);
    };

    const updateUserNotification = (userId) => {
        const elem = document.querySelector(`.user-item[data-userid="${userId}"]`);
        if (!elem) return;
        const existing = elem.querySelector('.user-notification-dot');
        if (existing) existing.remove();
        const count = unreadMessages[userId];
        if (count > 0) {
            const span = document.createElement('span');
            span.className = 'user-notification-dot';
            span.textContent = count;
            elem.appendChild(span);
        }
    };

    const updateAllUserNotifications = () => {
        Object.keys(unreadMessages).forEach(updateUserNotification);
        updateGlobalNotification();
    };

    const showNotification = () => notificationDot.classList.remove('hidden');
    const hideNotification = () => notificationDot.classList.add('hidden');

    const updateGlobalNotification = () => {
        const total = Object.values(unreadMessages).reduce((a,b)=>a+b,0);
        if (total > 0) showNotification();
        else hideNotification();
    };

    const checkUnreadMessages = async () => {
        try {
            const res = await fetch('/api/chat/unread-messages');
            const data = await res.json();
            if (data.success && data.unreadMessages) {
                unreadMessages = data.unreadMessages;
                updateAllUserNotifications();
            }
        } catch (err) {
            console.error('Error al verificar mensajes no leídos:', err);
        }
    };

    // --- EVENT LISTENERS ---
    chatFab.addEventListener('click', toggleChatWidget);
    closeBtn.addEventListener('click', toggleChatWidget);
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && selectedUserId && socket) {
            socket.emit('private message', { to: selectedUserId, content });
            appendMessage(content, 'sent');
            messageInput.value = '';
        }
    });

    // Inicializar mensajes pendientes al cargar la página
    checkUnreadMessages();
});
