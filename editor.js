
import { currentUser, showMessage, trackChatbotUsage, auth, db } from './script.js';
import { getDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let currentChatbot = null; // Local variable for the chatbot being edited on this page

export async function initEditorPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const botIdFromUrl = urlParams.get('id');
    const selectedBotId = botIdFromUrl || localStorage.getItem('selectedChatbotId');

    const noChatbotMessage = document.getElementById('no-chatbot-selected-message');
    const editorContent = document.getElementById('chatbot-editor-content');
    const editorBotNameDisplay = document.getElementById('editor-bot-name-display');

    if (!selectedBotId) {
        noChatbotMessage?.classList.remove('hidden');
        editorContent?.classList.add('hidden');
        if (editorBotNameDisplay) editorBotNameDisplay.textContent = "No Chatbot Selected";
        return;
    }

    try {
        const docRef = doc(db, 'chatbots', selectedBotId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().userId === currentUser.uid) {
            currentChatbot = { id: docSnap.id, ...docSnap.data() };
            noChatbotMessage?.classList.add('hidden');
            editorContent?.classList.remove('hidden');
            populateFormFields();
            if (editorBotNameDisplay) editorBotNameDisplay.textContent = currentChatbot.name;
            localStorage.setItem('selectedChatbotId', currentChatbot.id);
            switchTab('basic');
        } else {
            showMessage('Chatbot not found or you do not have permission to edit it. Redirecting to dashboard.', 'error');
            localStorage.removeItem('selectedChatbotId');
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Error loading chatbot for editor:', error);
        showMessage('Error loading chatbot. Please try again. Redirecting to dashboard.', 'error');
        localStorage.removeItem('selectedChatbotId');
        window.location.href = 'dashboard.html';
    }
}

function populateFormFields() {
    if (!currentChatbot) return;

    document.getElementById('bot-name').value = currentChatbot.name || '';
    document.getElementById('bot-description').value = currentChatbot.description || '';
    document.getElementById('bot-personality').value = currentChatbot.personality || 'You are a helpful assistant.';
    document.getElementById('bot-public').checked = currentChatbot.isPublic || false;

    document.getElementById('ai-provider').value = currentChatbot.aiProvider || '';
    document.getElementById('ai-api-key').value = currentChatbot.aiApiKey || '';
    document.getElementById('search-provider').value = currentChatbot.searchProvider || '';
    document.getElementById('search-api-key').value = currentChatbot.searchApiKey || '';

    document.getElementById('theme-color').value = currentChatbot.themeColor || '#667eea';
    document.getElementById('welcome-message-text').value = currentChatbot.welcomeMessage || 'Hi! How can I help you today?';
    document.getElementById('chat-title').value = currentChatbot.chatTitle || 'Chat with AI';
    document.getElementById('bot-avatar').value = currentChatbot.botAvatar || '';
    document.getElementById('splash-text').value = currentChatbot.splashText || 'Loading your AI...';
    document.getElementById('header-text').value = currentChatbot.headerText || 'Chat with AI';

    // New customization fields
    document.getElementById('chat-layout').value = currentChatbot.chatLayout || 'default';
    document.getElementById('enable-chat-history').checked = currentChatbot.enableChatHistory || false;
    document.getElementById('enable-search-bar').checked = currentChatbot.enableSearchBar || false;
    document.getElementById('enable-bot-profile').checked = currentChatbot.enableBotProfile || false;
    document.getElementById('require-chatbot-auth').checked = currentChatbot.requireChatbotAuth || false;
    document.getElementById('message-user-color').value = currentChatbot.messageUserColor || '#007bff';
    document.getElementById('message-bot-color').value = currentChatbot.messageBotColor || '#e9ecef';
    document.getElementById('message-user-text-color').value = currentChatbot.messageUserTextColor || '#ffffff';
    document.getElementById('message-bot-text-color').value = currentChatbot.messageBotTextColor || '#333333';


    document.getElementById('subdomain').value = currentChatbot.subdomain || '';
    document.getElementById('deployment-password').value = currentChatbot.deploymentPassword || '';

    window.updateSubdomainPreview(); // Call the global function

    updateAPIFields();
    document.getElementById('initial-welcome-message-preview').textContent = currentChatbot.welcomeMessage;

    if (currentChatbot.deployed) {
        document.getElementById('deployment-status')?.classList.remove('hidden');
        document.getElementById('deploy-status').textContent = 'Saved as Deployed';
        document.getElementById('deployed-url').href = `https://${currentChatbot.subdomain}.aichatbot.com`;
        document.getElementById('deployed-url').textContent = `https://${currentChatbot.subdomain}.aichatbot.com`;
        document.getElementById('last-updated').textContent = new Date().toLocaleString();
    } else {
        document.getElementById('deployment-status')?.classList.add('hidden');
    }
}

// --- Editor Save Functions ---
window.saveBasicSettings = async function() {
    if (!currentChatbot) { showMessage('No chatbot selected.', 'error'); return; }
    currentChatbot.name = document.getElementById('bot-name').value;
    currentChatbot.description = document.getElementById('bot-description').value;
    currentChatbot.personality = document.getElementById('bot-personality').value;
    currentChatbot.isPublic = document.getElementById('bot-public').checked;
    currentChatbot.updatedAt = new Date().toISOString();
    await updateChatbotInFirestore();
    showMessage('Basic settings saved successfully!', 'success');
    document.getElementById('editor-bot-name-display').textContent = currentChatbot.name;
};

window.saveAPISettings = async function() {
    if (!currentChatbot) { showMessage('No chatbot selected.', 'error'); return; }
    currentChatbot.aiProvider = document.getElementById('ai-provider').value;
    currentChatbot.aiApiKey = document.getElementById('ai-api-key').value;
    currentChatbot.aiModel = document.getElementById('ai-model').value;
    currentChatbot.searchProvider = document.getElementById('search-provider').value;
    currentChatbot.searchApiKey = document.getElementById('search-api-key').value;
    currentChatbot.updatedAt = new Date().toISOString();
    await updateChatbotInFirestore();
    showMessage('API settings saved successfully!', 'success');
};

window.saveCustomization = async function() {
    if (!currentChatbot) { showMessage('No chatbot selected.', 'error'); return; }
    currentChatbot.themeColor = document.getElementById('theme-color').value;
    currentChatbot.welcomeMessage = document.getElementById('welcome-message-text').value;
    currentChatbot.chatTitle = document.getElementById('chat-title').value;
    currentChatbot.botAvatar = document.getElementById('bot-avatar').value;
    currentChatbot.splashText = document.getElementById('splash-text').value;
    currentChatbot.headerText = document.getElementById('header-text').value;

    // New customization fields save
    currentChatbot.chatLayout = document.getElementById('chat-layout').value;
    currentChatbot.enableChatHistory = document.getElementById('enable-chat-history').checked;
    currentChatbot.enableSearchBar = document.getElementById('enable-search-bar').checked;
    currentChatbot.enableBotProfile = document.getElementById('enable-bot-profile').checked;
    currentChatbot.requireChatbotAuth = document.getElementById('require-chatbot-auth').checked;
    currentChatbot.messageUserColor = document.getElementById('message-user-color').value;
    currentChatbot.messageBotColor = document.getElementById('message-bot-color').value;
    currentChatbot.messageUserTextColor = document.getElementById('message-user-text-color').value;
    currentChatbot.messageBotTextColor = document.getElementById('message-bot-text-color').value;

    currentChatbot.updatedAt = new Date().toISOString();
    await updateChatbotInFirestore();
    showMessage('Customization saved successfully!', 'success');
    document.getElementById('initial-welcome-message-preview').textContent = currentChatbot.welcomeMessage;
};

async function updateChatbotInFirestore() {
    if (!currentChatbot) return;
    try {
        await updateDoc(doc(db, 'chatbots', currentChatbot.id), { ...currentChatbot });
    } catch (error) {
        showMessage('Failed to save chatbot: ' + error.message, 'error');
        console.error('Error updating chatbot:', error);
    }
}

// Tab switching (editor specific)
window.switchTab = function(tabName) {
    document.querySelectorAll('.editor-sidebar .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.editor-content .tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.editor-sidebar .tab[onclick="switchTab('${tabName}')"]`)?.classList.add('active');
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    showMessage('', 'clear');
};

// API Model options
function updateAPIFields() {
    const provider = document.getElementById('ai-provider')?.value;
    const modelSelect = document.getElementById('ai-model');

    if (!modelSelect) return;

    modelSelect.innerHTML = '<option value="">Select Model</option>';
    let models = [];
    switch(provider) {
        case 'gemini':
            models = [
                { value: "gemini-1.5-flash", text: "Gemini 1.5 Flash" },
                { value: "gemini-1.5-pro", text: "Gemini 1.5 Pro" },
                { value: "gemini-1.0-pro", text: "Gemini 1.0 Pro" },
            ];
            break;
        case 'deepseek':
            models = [
                { value: "deepseek/deepseek-chat", text: "DeepSeek Chat" },
                { value: "deepseek/deepseek-coder", text: "DeepSeek Coder" },
            ];
            break;
        case 'openai':
            models = [
                { value: "openai/gpt-4", text: "GPT-4" },
                { value: "openai/gpt-3.5-turbo", text: "GPT-3.5 Turbo" },
            ];
            break;
    }
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.text;
        modelSelect.appendChild(option);
    });

    if (currentChatbot && currentChatbot.aiModel) {
        modelSelect.value = currentChatbot.aiModel;
    }
}

// --- Testing functions ---
window.testAPIConnection = async function() {
    if (!currentChatbot || !currentChatbot.aiProvider || !currentChatbot.aiApiKey || !currentChatbot.aiModel) {
        showMessage('Please configure AI Provider, API Key, and Model in API Configuration tab first.', 'error');
        return;
    }

    showMessage('Testing API connection...', 'info');

    try {
        const response = await callAI('Hello, this is a test message. Respond with "API OK".', true);
        if (response && response.toLowerCase().includes('api ok')) {
            showMessage('API connection successful! Response: ' + response, 'success');
        } else {
            showMessage('API connection failed. Please check your settings. Response: ' + (response || 'No valid response.'), 'error');
        }
    } catch (error) {
        showMessage('API test failed: ' + error.message, 'error');
        console.error('API test error:', error);
    }
};

window.testMessage = async function() {
    const input = document.getElementById('test-message');
    const message = input.value.trim();
    if (!message) return;

    if (!currentChatbot || !currentChatbot.aiProvider || !currentChatbot.aiApiKey || !currentChatbot.aiModel) {
        showMessage('Please configure AI Provider, API Key, and Model in API Configuration tab before testing messages.', 'error');
        return;
    }

    addMessageToChat('user', message);
    input.value = '';

    showTypingInPreview(true);

    try {
        const response = await callAI(message);
        showTypingInPreview(false);
        addMessageToChat('bot', response || 'Sorry, I couldn\'t process that request.');
        trackChatbotUsage(currentChatbot.id, 'message_sent');
    } catch (error) {
        showTypingInPreview(false);
        addMessageToChat('bot', 'Error: ' + error.message);
        console.error('Error during test message:', error);
    }
};

function addMessageToChat(sender, message) {
    const chatPreview = document.getElementById('chat-preview');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.style.backgroundColor = sender === 'user' ? currentChatbot.messageUserColor : currentChatbot.messageBotColor;
    messageDiv.style.color = sender === 'user' ? currentChatbot.messageUserTextColor : currentChatbot.messageBotTextColor;

    messageDiv.innerHTML = `<strong>${sender === 'user' ? 'You' : 'Bot'}:</strong> ${message}`;
    chatPreview.appendChild(messageDiv);
    chatPreview.scrollTop = chatPreview.scrollHeight;
}

function showTypingInPreview(show) {
    const chatPreview = document.getElementById('chat-preview');
    if (show) {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'preview-typing-indicator';
        typingDiv.className = 'message bot typing-indicator-preview';
        typingDiv.innerHTML = '<strong>Bot:</strong> Typing...';
        chatPreview.appendChild(typingDiv);
        chatPreview.scrollTop = chatPreview.scrollHeight;
    } else {
        const typingDiv = document.getElementById('preview-typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }
}

async function performSearch(query) {
    if (!currentChatbot.searchProvider || !currentChatbot.searchApiKey) return '';

    if (currentChatbot.searchProvider === 'serp') {
        console.warn('SerpAPI key is exposed in the client-side code and subject to CORS. Use a backend proxy for production.');
        showMessage('Search integration with SerpAPI requires a backend proxy due to API key security and CORS. Mocking search results for preview.', 'info', 7000);
        return `[Mock Search Results for "${query}": Result 1, Result 2]`;
    }
    return '';
}

async function callAI(message, isTestConnection = false) {
    if (!currentChatbot || !currentChatbot.aiApiKey || !currentChatbot.aiProvider || !currentChatbot.aiModel) {
        throw new Error('AI API not configured or incomplete');
    }

    const provider = currentChatbot.aiProvider;
    const apiKey = currentChatbot.aiApiKey;
    const model = currentChatbot.aiModel;
    const personality = currentChatbot.personality;

    let apiUrl, headers, body;
    let messages = [];

    let searchResults = '';
    if (!isTestConnection && currentChatbot.enableSearchBar && currentChatbot.searchProvider && currentChatbot.searchApiKey) {
        searchResults = await performSearch(message);
    }

    // --- Gemini API Note ---
    // The `v1beta` endpoint is correct for Gemini models like gemini-1.5-flash and gemini-1.5-pro.
    // The Firebase JS SDK version (e.g., 9.22.0) is for Firebase services, not the Generative AI API version.
    // The "2.5" mentioned in the prompt is not a standard Gemini model version.
    // Current usage is aligned with Google's Generative AI documentation for these models.

    if (provider === 'gemini') {
        let geminiPrompt = personality;
        if (searchResults) { geminiPrompt += `\n\nSearch Results: ${searchResults}`; }
        geminiPrompt += `\n\nUser: ${message}`;
        messages.push({ parts: [{ text: geminiPrompt }] });
    } else {
        messages.push({ role: 'system', content: personality });
        let userContent = message;
        if (searchResults) { userContent = `Search Results: ${searchResults}\n\n${message}`; }
        messages.push({ role: 'user', content: userContent });
    }

    switch (provider) {
        case 'gemini':
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            headers = { 'Content-Type': 'application/json', };
            body = JSON.stringify({ contents: messages }); break;
        case 'deepseek':
        case 'openai':
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', };
            body = JSON.stringify({ model: model, messages: messages }); break;
        default: throw new Error('Unsupported AI provider');
    }

    const response = await fetch(apiUrl, { method: 'POST', headers: headers, body: body });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || errorData.error || response.statusText;
        throw new Error(`API call failed: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

    switch (provider) {
        case 'gemini': return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        case 'deepseek':
        case 'openai': return data.choices?.[0]?.message?.content || 'No response';
        default: return 'Unknown response format';
    }
}

// --- Deployment & Share Functions ---
window.deployChatbot = async function() {
    if (!currentChatbot) { showMessage('No chatbot selected.', 'error'); return; }

    const subdomain = document.getElementById('subdomain').value.trim();
    if (!subdomain) { showMessage('Please enter a subdomain for deployment.', 'error'); return; }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        showMessage('Invalid subdomain format. Use lowercase letters, numbers, and hyphens only. Must start and end with alphanumeric characters.', 'error');
        return;
    }

    currentChatbot.subdomain = subdomain;
    currentChatbot.deploymentPassword = document.getElementById('deployment-password').value;
    currentChatbot.deployed = true;
    currentChatbot.updatedAt = new Date().toISOString();

    await updateChatbotInFirestore();

    document.getElementById('deployment-status')?.classList.remove('hidden');
    document.getElementById('deploy-status').textContent = 'Saved as Deployed';
    document.getElementById('deployed-url').href = `https://${currentChatbot.subdomain}.aichatbot.com`;
    document.getElementById('deployed-url').textContent = `https://${currentChatbot.subdomain}.aichatbot.com`;
    document.getElementById('last-updated').textContent = new Date().toLocaleString();

    showMessage('Deployment settings saved! Use share/embed/download options below for live versions.', 'success');
    trackChatbotUsage(currentChatbot.id, 'deployed');
};

window.generateShareLink = function() {
    if (!currentChatbot || !currentChatbot.id) {
        showMessage('Please save your chatbot first to generate a shareable link.', 'error');
        return;
    }
    const baseUrl = window.location.origin;
    const shareLink = `${baseUrl}/chat.html?id=${currentChatbot.id}`;
    document.getElementById('share-link').value = shareLink;
    showMessage('Shareable link generated! Copy and share it.', 'info');
};

window.copyShareLink = function() {
    const shareLink = document.getElementById('share-link');
    if (!shareLink?.value) { showMessage('Generate the share link first.', 'info'); return; }
    shareLink.select();
    document.execCommand('copy');
    showMessage('Share link copied to clipboard!', 'success');
};

window.generateEmbedCode = function() {
    if (!currentChatbot || !currentChatbot.id) {
        showMessage('Please save your chatbot first to generate embed code.', 'error');
        return;
    }

    const baseUrl = window.location.origin;
    const embedSrc = `${baseUrl}/chat.html?id=${currentChatbot.id}&embed=true`;

    const embedCode = `<iframe
    src="${embedSrc}"
    width="400"
    height="600"
    frameborder="0"
    style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</iframe>

<script>
    window.addEventListener('message', function(event) {
        if (event.origin !== '${baseUrl}') return;
        if (event.data.type === 'chatbot-resize') {
            const iframe = document.querySelector('iframe[src*="${currentChatbot.id}"]');
            if (iframe) {
                iframe.style.height = event.data.height + 'px';
            }
        }
    });
</script>`;

    document.getElementById('embed-code').value = embedCode;
    showMessage('Embed code generated!', 'info');
};

window.copyEmbedCode = function() {
    const embedCode = document.getElementById('embed-code');
    if (!embedCode?.value) { showMessage('Generate the embed code first.', 'info'); return; }
    embedCode.select();
    document.execCommand('copy');
    showMessage('Embed code copied to clipboard!', 'success');
};


window.generateStandaloneChatbot = function() {
    if (!currentChatbot) { showMessage('No chatbot selected.', 'error'); return; }

    showMessage('WARNING: Standalone HTML includes API keys directly. This is a security risk for production! Use a backend proxy for secure deployment.', 'error', 10000);

    const pwaManifest = `
        <link rel="manifest" href="data:application/json;base64,${btoa(JSON.stringify({
            name: currentChatbot.chatTitle, short_name: currentChatbot.name,
            description: currentChatbot.description || 'AI Chatbot', start_url: "./", display: "standalone",
            background_color: currentChatbot.themeColor, theme_color: currentChatbot.themeColor,
            icons: [{ "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik02IDhINGgxdjYuMzc0TDcgMTZhMTkuMzUgMTkuMzUgMCAwIDAtMi43NzUtMi45OTRDMjYuODg3IDkuODAzIDIzLjg1NSA2LjQ5MiAxNi44MTMgNC40MjMgMTAuODc1IDIuMjczIDQuNzEzIDYuMTEyIDIuNTU2IDEyLDEuMjE4IDE1LjkxIDQuMDQ4IDIxLjA2NSA3LjEwNyAyMy4wNEMxMC42ODYgMjUuMzQyIDE0Ljk4MyAyNC43NDQgMTguNTMzIDIyLjM3YTIwLjEyMSAyMC4xMjEgMCAwIDAgMy42OTYtNC4wNjcgMi41MiAyLjUyIDAgMCAwIC43NjItLjcxMi43OTMuNzkzIDAgMCAwLS4wNi0uNzc5IDIy.MTc5IDIy.MTc5IDAgMCAwLTIuOTk0LS40NzFDMjAuODUzIDE2LjM1MiAxNy4xMjIgMTQuNjQ0IDE1LjExNyAxNC4wN2MtLjQ4Ni0uMjY3LS45ODgtLjU0My0xLjU1NC0uODI2bC00LjY4MS0yLjU2M2MtMi4wNzYtLjc1Ny0zLjM1OC0xLjg0NS0zLjE1OS0zLjM0My4xNjMtMS4xOTggMS40NjktMS44MTcgMy42Ni0xLjU1NCA1LjIxNS43NzcgOS42MTggMy44NTkgMTEuODk0IDYuOTY0IDEuMDM0IDEuNDI4IDEuMTY1IDIuMTg5LjM5MyAzLjM0My0yLjIwOCAzLjI0Mi00LjQ4NSA1LjQ1My02LjY3IDcuMDY1LTMuMjI4IDIuNzc2LTYuNzIyIDIuODk1LTguNDk1IDIuMjUzLTEuODQtLjU5LTEuNjY5LTEuOTQ1LTEuMzQ3LTMuNjY5LjY0OC0x.NjIzIDIuNjcxLTMuNTY5IDQuNzc2LTQuNjY5YTMuOTE3IDMuOTE3IDAgMCAwLS44MTktLjcxOWMtLjA0My0uMDUxLS4wODQtLjA5OC0uMTIzLS4xNDQtNC41NzMtMy41NDgtMi45MjEtOS4zMzEgMi43NDgtMTEuNzI3IDMuMDE3LS42ODYgNS4wNTYuNTYgNi4xNTUgMy41NzMuNDI4IDEuMTM1LS4wOTYgMi4yMjktLjE1OSAzLjI2NC43MTEuMTIxIDEuNDA0LjU2NiAxLjU3NiAxLjA1My43MzYyLjEwNy0uNjgzIDMuMzI2LTEuODc1IDMuNTkzLS43OTIuMTQyLTEuNzk2LjEyMy0yLjI3Ni0uNzcxLTEuNzQ4LTEuNjk2LTQuMDQzLTMuNDg1LTQuMjcxLTUuNzgtLjEzMi0xLjM1My0zLjQ0LTUuNzMzLTYuODQtOC4zNy0zLjgyLTIuODQtNy4xNS0yLjg4LTMuNzEtMi4yNS0xLjYyLjIwNC0zLjI2OSAxLjUxLTMuODQzIDIuNTc3SDBWMjRoMjRaIi8+PC9zdmc+" ,"sizes":"512x512","type":"image/svg+xml"}]
        }))}">
    `;
    const pwaServiceWorkerScript = `
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('data:application/javascript;base64,${btoa(`
                        const CACHE_NAME = 'standalone-chatbot-v1'; const urlsToCache = [ './' ];
                        self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => { console.log('Standalone Chatbot SW: Cache opened'); return cache.addAll(urlsToCache); }).catch(error => console.error('Standalone Chatbot SW: Cache addAll failed:', error))); });
                        self.addEventListener('fetch', (event) => { event.respondWith(caches.match(event.request).then((response) => { if (response) { return response; } return fetch(event.request); }).catch(error => console.error('Standalone Chatbot SW: Fetch failed:', error))); });
                        self.addEventListener('activate', (event) => { const cacheWhitelist = [CACHE_NAME]; event.waitUntil(caches.keys().then((cacheNames) => { return Promise.all(cacheNames.map((cacheName) => { if (cacheWhitelist.indexOf(cacheName) === -1) { return caches.delete(cacheName); } })); })); });
                    `)}')
                        .then(reg => console.log('Standalone Chatbot PWA Service Worker Registered:', reg))
                        .catch(err => console.error('Standalone Chatbot PWA Service Worker failed:', err));
                });
            }
        </script>
    `;

    // Dynamic HTML for the standalone chatbot
    let chatHtmlContent = `
        <div class="chat-header" style="background: ${currentChatbot.themeColor || '#667eea'};">
            <h1>${currentChatbot.headerText || currentChatbot.chatTitle || 'Chat with AI'}</h1>
            <p>${currentChatbot.name}</p>
        </div>
        <div class="chat-messages" id="chat-messages">
            <div class="message bot" style="background:${currentChatbot.messageBotColor}; color:${currentChatbot.messageBotTextColor};">${currentChatbot.welcomeMessage}</div>
        </div>
        <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Type your message..." onkeypress="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()" style="background:${currentChatbot.themeColor || '#667eea'};">Send</button>
        </div>
    `;

    // Add sidebar if enabled (basic placeholder, no actual functionality without more code)
    let sidebarHtml = '';
    if (currentChatbot.enableBotProfile) {
        sidebarHtml = `
            <div class="chat-sidebar" style="background: rgba(0,0,0,0.05); padding: 20px; border-left: 1px solid #eee; width: 150px; flex-shrink: 0;">
                <h3 style="color: ${currentChatbot.themeColor};">${currentChatbot.name}</h3>
                <img src="${currentChatbot.botAvatar || 'https://via.placeholder.com/80'}" alt="Bot Avatar" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">
                <p style="font-size: 0.8em; color: #666;">${currentChatbot.description || 'AI Assistant'}</p>
                <div style="margin-top: 15px; font-size: 0.7em; color: #888;">
                    ${currentChatbot.aiProvider ? `AI: ${currentChatbot.aiProvider.charAt(0).toUpperCase() + currentChatbot.aiProvider.slice(1)}<br>` : ''}
                    ${currentChatbot.enableSearchBar ? 'Search: Enabled' : 'Search: Disabled'}
                </div>
            </div>
        `;
        // Adjust chat container to be within a flex wrapper if sidebar is present
        chatHtmlContent = `
            <div style="display:flex; height:100%;">
                ${sidebarHtml}
                <div class="chat-container" style="flex-grow:1; box-shadow:none; border-radius:0;">
                    ${chatHtmlContent}
                </div>
            </div>
        `;
    }

    const generatedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentChatbot.chatTitle}</title>
    <meta name="theme-color" content="${currentChatbot.themeColor}">
    ${pwaManifest}
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, ${currentChatbot.themeColor} 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; overflow: hidden; }
        .chat-container { background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); width: 100%; max-width: 500px; height: 600px; display: flex; flex-direction: column; overflow: hidden; }
        .chat-header { background: ${currentChatbot.themeColor}; color: white; padding: 20px; text-align: center; }
        .chat-header h1 { font-size: 1.2em; margin-bottom: 5px; }
        .chat-messages { flex: 1; padding: 20px; overflow-y: auto; background: #f8f9fa; ${currentChatbot.chatLayout === 'compact' ? 'padding: 10px;' : ''} }
        .message { margin-bottom: 15px; padding: 10px 15px; border-radius: 18px; max-width: 80%; word-wrap: break-word; }
        .message.user { background: ${currentChatbot.messageUserColor}; color: ${currentChatbot.messageUserTextColor}; margin-left: auto; text-align: right; }
        .message.bot { background: ${currentChatbot.messageBotColor}; color: ${currentChatbot.messageBotTextColor}; margin-right: auto; }
        .chat-input { display: flex; padding: 20px; background: white; border-top: 1px solid #eee; }
        .chat-input input { flex: 1; padding: 12px; border: 2px solid #e1e5e9; border-radius: 25px; font-size: 16px; outline: none; }
        .chat-input input:focus { border-color: ${currentChatbot.themeColor}; }
        .chat-input button { background: ${currentChatbot.themeColor}; color: white; border: none; padding: 12px 20px; border-radius: 25px; margin-left: 10px; cursor: pointer; font-size: 16px; }
        .chat-input button:hover { opacity: 0.9; }
        .typing-indicator { display: none; padding: 10px 15px; background: ${currentChatbot.messageBotColor}; border-radius: 18px; max-width: 80%; margin-bottom: 15px; margin-right: auto; }
        .typing-dots { display: flex; gap: 3px; }
        .typing-dots span { width: 8px; height: 8px; border-radius: 50%; background: #666; animation: typing 1.4s infinite; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-10px); opacity: 1; }}

        ${currentChatbot.enableSearchBar ? `
        .search-bar { padding: 10px 20px; background: #f0f0f0; border-bottom: 1px solid #ddd; }
        .search-bar input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px; }
        ` : ''}

        ${currentChatbot.chatLayout === 'compact' ? `
        .message { margin-bottom: 8px; font-size: 0.9em; padding: 8px 12px; }
        .chat-input { padding: 10px 15px; }
        .chat-input input, .chat-input button { padding: 8px 15px; font-size: 14px; }
        .chat-header { padding: 15px 20px; }
        ` : ''}
    </style>
</head>
<body>
    <div style="display:flex; height:100%; max-width: ${currentChatbot.enableBotProfile ? '650px' : '500px'}; width:100%;">
        <div class="chat-container">
            ${currentChatbot.enableSearchBar ? '<div class="search-bar"><input type="text" placeholder="Search... (not functional in demo)"></div>' : ''}
            ${chatHtmlContent}
        </div>
    </div>
    <script>
        const chatbotConfig = {
            aiProvider: '${currentChatbot.aiProvider}',
            aiApiKey: '${currentChatbot.aiApiKey}',
            aiModel: '${currentChatbot.aiModel}',
            personality: \`${currentChatbot.personality.replace(/`/g, '\\`')}\`,
            searchProvider: '${currentChatbot.searchProvider}',
            searchApiKey: '${currentChatbot.searchApiKey}',
            // PWA generated file includes these configs for styling
            messageUserColor: '${currentChatbot.messageUserColor}',
            messageBotColor: '${currentChatbot.messageBotColor}',
            messageUserTextColor: '${currentChatbot.messageUserTextColor}',
            messageBotTextColor: '${currentChatbot.messageBotTextColor}',
            enableChatHistory: ${currentChatbot.enableChatHistory},
            requireChatbotAuth: ${currentChatbot.requireChatbotAuth} // Placeholder: not functional client-side
        };
        async function sendMessage() {
            if (chatbotConfig.requireChatbotAuth) {
                alert('Authentication required for this chatbot. (Feature not implemented in client-side demo)');
                return;
            }
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            if (!message) return;
            addMessage('user', message);
            input.value = '';
            showTyping(true);
            try {
                const response = await callAI(message);
                showTyping(false);
                addMessage('bot', response || 'Sorry, I couldn\\'t process that request.');
            } catch (error) {
                showTyping(false);
                addMessage('bot', 'Sorry, I encountered an error. Please try again. (' + error.message + ')');
            }
        }
        function addMessage(sender, message) {
            const messagesContainer = document.getElementById('chat-messages');
            if (!messagesContainer) return;
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;
            messageDiv.textContent = message;
            messageDiv.style.backgroundColor = sender === 'user' ? chatbotConfig.messageUserColor : chatbotConfig.messageBotColor;
            messageDiv.style.color = sender === 'user' ? chatbotConfig.messageUserTextColor : chatbotConfig.messageBotTextColor;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        function showTyping(show) {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) { indicator.style.display = show ? 'block' : 'none'; }
            if (show) { messagesContainer.scrollTop = messagesContainer.scrollHeight; }
        }
        async function callAI(message) {
            if (!chatbotConfig.aiApiKey || !chatbotConfig.aiProvider || !chatbotConfig.aiModel) { throw new Error('AI API not configured'); }
            const provider = chatbotConfig.aiProvider; const apiKey = chatbotConfig.aiApiKey; const model = chatbotConfig.aiModel; const personality = chatbotConfig.personality;
            let apiUrl, headers, body; let messages = [];
            let searchResults = '';
            // Only perform search if enabled and configured (only for production backends)
            if (chatbotConfig.enableSearchBar && chatbotConfig.searchProvider && chatbotConfig.searchApiKey) {
                searchResults = await performSearch(message); // This will show client-side warning
            }
            if (provider === 'gemini') { let geminiPrompt = personality; if (searchResults) { geminiPrompt += \`\\n\\nSearch Results: \${searchResults}\`; } geminiPrompt += \`\\n\\nUser: \${message}\`; messages.push({ parts: [{ text: geminiPrompt }] }); }
            else { messages.push({ role: 'system', content: personality }); let userContent = message; if (searchResults) { userContent = \`Search Results: \${searchResults}\\n\\n\${message}\`; } messages.push({ role: 'user', content: userContent }); }
            switch (provider) {
                case 'gemini': apiUrl = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`; headers = { 'Content-Type': 'application/json', }; body = JSON.stringify({ contents: messages }); break;
                case 'deepseek': case 'openai': apiUrl = 'https://openrouter.ai/api/v1/chat/completions'; headers = { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json', }; body = JSON.stringify({ model: model, messages: messages }); break;
                default: throw new Error('Unsupported AI provider');
            }
            const response = await fetch(apiUrl, { method: 'POST', headers: headers, body: body });
            if (!response.ok) { const errorData = await response.json(); const errorMessage = errorData.error?.message || errorData.error || response.statusText; throw new Error(\`API call failed: \${response.status} - \${errorMessage}\`); }
            const data = await response.json();
            switch (provider) {
                case 'gemini': return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
                case 'deepseek': case 'openai': return data.choices?.[0]?.message?.content || 'No response';
                default: return 'Unknown response format';
            }
        }
        async function performSearch(query) {
            if (!chatbotConfig.searchProvider || !chatbotConfig.searchApiKey) return '';
            try {
                if (chatbotConfig.searchProvider === 'serp') {
                    console.warn('SerpAPI key is exposed in the client-side code. Use a backend proxy for production.');
                    // This mock is for demo purposes. Real search requires a backend proxy.
                    alert('Search function is mocked in this standalone demo due to security. A backend is needed for real search.');
                    return \`[Mock Search Results for "\${query}": Result 1, Result 2]\`;
                }
            } catch (error) { console.error('Search failed:', error); return ''; }
            return '';
        }
        document.getElementById('message-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') { sendMessage(); } });
        document.getElementById('message-input').focus();
    </script>
    ${pwaServiceWorkerScript}
</body>
</html>`;

    const blob = new Blob([generatedHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentChatbot.name.replace(/\s+/g, '-').toLowerCase()}-chatbot.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('Standalone chatbot HTML downloaded! It can now be installed as a PWA.', 'success');
};

// Subdomain preview event listener (attached once in editor.js)
document.addEventListener('DOMContentLoaded', () => {
    const subdomainInput = document.getElementById('subdomain');
    if (subdomainInput) {
        subdomainInput.addEventListener('input', window.updateSubdomainPreview);
    }
});