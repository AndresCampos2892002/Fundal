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

    // --- ESTADO DEL CHAT ---
    let socket = null;
    let selectedUserId = null;
    let isChatInitialized = false;

    // --- LÓGICA PARA ARRASTRAR EL BOTÓN ---
    let isDragging = false;
    let wasDragged = false;
    let offsetX, offsetY;

    // --- FUNCIONES DEL WIDGET ---

    // Función para mostrar/ocultar el widget
    const toggleChatWidget = () => {
        chatWidget.classList.toggle('hidden');
        if (!chatWidget.classList.contains('hidden') && !isChatInitialized) {
            initChat();
        }
    };

    // Función para inicializar el chat (se llama solo la primera vez que se abre)
    const initChat = async () => {
        isChatInitialized = true;
        socket = io(); // Conecta con el servidor de Socket.IO

        try {
            const response = await fetch('/chat/users');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const users = await response.json();

            userList.innerHTML = ''; // Limpia el mensaje "Cargando..."

            if (users.length === 0) {
                userList.innerHTML = '<div class="p-3 text-center text-muted">No hay otros usuarios para chatear.</div>';
            } else {
                users.forEach(user => {
                    const userElement = document.createElement('div');
                    userElement.className = 'user-item p-3';
                    userElement.dataset.userid = user.id;
                    userElement.innerHTML = `<strong>${user.username}</strong><small class="text-muted d-block">${user.rol}</small>`;
                    userElement.addEventListener('click', () => selectUser(user));
                    userList.appendChild(userElement);
                });
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            userList.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar usuarios. Revisa la consola.</div>';
        }

        // Escucha los mensajes privados que llegan del servidor
        socket.on('private message', (message) => {
            if (message.from == selectedUserId) {
                appendMessage(message.content, 'received');
            }
        });
    };

    // Se ejecuta al seleccionar un usuario de la lista
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
        } catch (error) {
            console.error('Error al cargar historial:', error);
            messagesBox.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar mensajes.</div>';
        }
    };

    // Añade un mensaje (burbuja) a la ventana de chat
    const appendMessage = (content, type) => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = content;
        messagesBox.appendChild(messageElement);
        messagesBox.scrollTop = messagesBox.scrollHeight; // Scroll automático al final
    };

    // --- LÓGICA PARA ARRASTRAR EL BOTÓN ---
    const dragStart = (e) => {
        isDragging = true;
        wasDragged = false;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        offsetX = clientX - chatFab.getBoundingClientRect().left;
        offsetY = clientY - chatFab.getBoundingClientRect().top;
        chatFab.style.cursor = 'grabbing';
        chatFab.classList.add('dragging');
        if (e.type === 'touchstart') e.preventDefault();
    };

    const dragMove = (e) => {
        if (!isDragging) return;
        wasDragged = true;
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        let newX = clientX - offsetX;
        let newY = clientY - offsetY;
        const fabRect = chatFab.getBoundingClientRect();
        const maxX = window.innerWidth - fabRect.width;
        const maxY = window.innerHeight - fabRect.height;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        chatFab.style.left = `${newX}px`;
        chatFab.style.top = `${newY}px`;
        chatFab.style.bottom = 'auto';
        chatFab.style.right = 'auto';
    };

    const dragEnd = () => {
        if (isDragging) {
            isDragging = false;
            chatFab.style.cursor = 'grab';
            chatFab.classList.remove('dragging');
        }
    };

    // --- EVENT LISTENERS ---

    // Abrir/Cerrar widget al hacer click (y solo si no se arrastró)
    chatFab.addEventListener('click', (e) => {
        if (!wasDragged) {
            toggleChatWidget();
        }
    });
    closeBtn.addEventListener('click', toggleChatWidget);

    // Enviar mensaje del formulario
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && selectedUserId && socket) {
            socket.emit('private message', { to: selectedUserId, content });
            appendMessage(content, 'sent');
            messageInput.value = '';
        }
    });

    // Asigna los eventos para arrastrar el botón (mouse y touch)
    chatFab.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    chatFab.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove);
    document.addEventListener('touchend', dragEnd);
});

