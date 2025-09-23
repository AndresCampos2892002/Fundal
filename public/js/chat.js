document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
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

    // --- ESTADO DEL CHAT ---
    let socket = null;
    let selectedUserId = null;
    let isChatInitialized = false;
    let unreadMessages = {}; // { userId: count }

    // --- FUNCIONES DEL WIDGET ---

    const toggleChatWidget = () => {
        chatWidget.classList.toggle('hidden');
        if (!chatWidget.classList.contains('hidden') && !isChatInitialized) {
            initChat();
        }

        // Cuando se abre el chat, quitar notificación global
        if (!chatWidget.classList.contains('hidden')) {
            hideNotification();
        }
    };

    const initChat = async () => {
        isChatInitialized = true;
        socket = io();

        try {
            const response = await fetch('/chat/users');
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const users = await response.json();

            userList.innerHTML = '';

            if (users.length === 0) {
                userList.innerHTML = '<div class="p-3 text-center text-muted">No hay otros usuarios para chatear.</div>';
            } else {
                renderUsers(users);
                checkUnreadMessages(); // Verificar mensajes no leídos después de cargar usuarios
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            userList.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar usuarios.</div>';
        }

        // Escuchar mensajes en tiempo real
        socket.on('private message', (message) => {
            if (message.from == selectedUserId) {
                appendMessage(message.content, 'received');
                markAsRead(message.from);
            } else {
                addUnreadMessage(message.from);
                updateUserNotification(message.from);
                updateGlobalNotification();
            }
        });

        // Escuchar eventos de mensajes no leídos del servidor
        socket.on('unread messages', (data) => {
            if (data.unreadMessages) {
                unreadMessages = data.unreadMessages;
                updateAllUserNotifications();
                updateGlobalNotification();
            }
        });
    };

    // Renderizar lista de usuarios con notificaciones
    const renderUsers = (users) => {
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item p-3 position-relative';
            userElement.dataset.userid = user.id;

            const unreadCount = unreadMessages[user.id] || 0;
            const notificationBadge = unreadCount > 0 ? `<span class="user-notification-dot">${unreadCount}</span>` : '';

            userElement.innerHTML = `
                <strong>${user.username}</strong>
                <small class="text-muted d-block">${user.rol}</small>
                ${notificationBadge}
            `;

            userElement.addEventListener('click', () => selectUser(user));
            userList.appendChild(userElement);
        });
    };

    const selectUser = async (user) => {
        selectedUserId = user.id;

        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`.user-item[data-userid="${user.id}"]`).classList.add('active');

        chatHeader.textContent = `Conversación con ${user.username}`;
        inputArea.classList.remove('hidden');
        messagesBox.innerHTML = '<div class="p-3 text-center text-muted">Cargando mensajes...</div>';

        try {
            const response = await fetch(`/chat/history/${user.id}`);
            const history = await response.json();
            messagesBox.innerHTML = '';
            history.forEach(msg => appendMessage(msg.contenido, msg.de_usuario_id === currentUserId ? 'sent' : 'received'));

            markAsRead(user.id);
        } catch (error) {
            console.error('Error al cargar historial:', error);
            messagesBox.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar mensajes.</div>';
        }
    };

    const appendMessage = (content, type) => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = content;
        messagesBox.appendChild(messageElement);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    };

    // --- FUNCIONES DE NOTIFICACIÓN ---
    function showNotification() {
        notificationDot.classList.remove('hidden');
    }

    function hideNotification() {
        notificationDot.classList.add('hidden');
    }

    function addUnreadMessage(userId) {
        unreadMessages[userId] = (unreadMessages[userId] || 0) + 1;
    }

    function markAsRead(userId) {
        if (unreadMessages[userId]) {
            delete unreadMessages[userId];
            updateUserNotification(userId);
            updateGlobalNotification();

            fetch(`/chat/mark-read/${userId}`, { method: 'POST' })
                .catch(error => console.error('Error al marcar como leído:', error));
        }
    }

    function updateUserNotification(userId) {
        const userElement = document.querySelector(`.user-item[data-userid="${userId}"]`);
        if (userElement) {
            const existingBadge = userElement.querySelector('.user-notification-dot');
            if (existingBadge) existingBadge.remove();

            const unreadCount = unreadMessages[userId];
            if (unreadCount > 0) {
                const notificationBadge = document.createElement('span');
                notificationBadge.className = 'user-notification-dot';
                notificationBadge.textContent = unreadCount;
                userElement.appendChild(notificationBadge);
            }
        }
    }

    function updateAllUserNotifications() {
        document.querySelectorAll('.user-item').forEach(userElement => {
            const userId = userElement.dataset.userid;
            const existingBadge = userElement.querySelector('.user-notification-dot');
            if (existingBadge) existingBadge.remove();

            const unreadCount = unreadMessages[userId];
            if (unreadCount > 0) {
                const notificationBadge = document.createElement('span');
                notificationBadge.className = 'user-notification-dot';
                notificationBadge.textContent = unreadCount;
                userElement.appendChild(notificationBadge);
            }
        });
    }

    function updateGlobalNotification() {
        const totalUnread = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);
        if (totalUnread > 0) {
            showNotification();
            chatFab.title = `Abrir Chat (${totalUnread} mensajes nuevos)`;
        } else {
            hideNotification();
            chatFab.title = 'Abrir Chat';
        }
    }

    // Verificar mensajes no leídos del servidor al cargar y cada 30s
    function checkUnreadMessages() {
        fetch('/api/chat/unread-messages')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.unreadMessages) {
                    unreadMessages = data.unreadMessages;
                    updateAllUserNotifications();
                    updateGlobalNotification();
                }
            })
            .catch(error => console.error('Error al verificar mensajes no leídos:', error));
    }

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

    // --- INICIALIZACIÓN ---
    checkUnreadMessages();
    setInterval(checkUnreadMessages, 30000); // Cada 30s
});
