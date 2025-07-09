import { currentUser, showMessage, trackChatbotUsage, auth, db } from './script.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let currentChatbotData = null;
let chatHistory = []; // To store conversation history

export async function initChatPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const botId = urlParams.get('id');
    const isEmbed = urlParams.get('embed') === 'true';

    const loadingMessageDiv = document.getElementById('loading-message');
    const chatbotWrapperDiv = document.getElementById('chatbot-container-wrapper');

    if (!botId) {
        if (loadingMessageDiv) loadingMessageDiv.textContent = "Error: Chatbot ID not provided in the URL.";
        return;
    }

    if (loadingMessageDiv) loadingMessageDiv.textContent = currentChatbotData?.splashText || "";

    try {
        const docRef = doc(db, 'chatbots', botId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const botData = docSnap.data();

            let hasPermission = false;
            if (botData.isPublic === true) {
                hasPermission = true;
            } else if (currentUser && botData.userId === currentUser.uid) {
                hasPermission = true;
            }

            if (!hasPermission) {
                if (loadingMessageDiv) loadingMessageDiv.textContent = "Access Denied: This chatbot is private.";
                showMessage("Access to this chatbot is restricted. It might be private.", "error");
                return;
            }

            // --- Chatbot Authentication Check (CLIENT-SIDE PLACEHOLDER) ---
            if (botData.requireChatbotAuth) {
                if (loadingMessageDiv) loadingMessageDiv.textContent = "Authentication Required: This chatbot requires login.";
                showMessage("This chatbot requires user authentication to interact. (Feature not implemented client-side for security).", "error", 10000);
                return;
            }
            // --- END WARNING ---

            currentChatbotData = botData;
            document.title = botData.chatTitle || 'AI Chatbot';
            document.body.style.background = `linear-gradient(135deg, ${botData.themeColor || '#667eea'} 0%, #764ba2 100%)`;


            // Build dynamic HTML for the chatbot
            let sidebarHtml = '';
            let chatWindowClasses = 'chat-window';
            let chatWrapperMaxWidth = '500px'; // Default without sidebar

            if (botData.enableBotProfile) {
                chatWindowClasses += ' has-sidebar';
                sidebarHtml = `
                    <div class="chat-sidebar" id="chat-sidebar" style="background: rgba(0,0,0,0.05);">
                        <h3 style="color: ${botData.themeColor || '#667eea'};">${botData.name}</h3>
                        <img src="${botData.botAvatar || 'https://via.placeholder.com/80'}" alt="Bot Avatar">
                        <p>${botData.description || 'AI Assistant'}</p>
                        <div class="bot-meta-info">
                            ${botData.aiProvider ? `AI: ${botData.aiProvider.charAt(0).toUpperCase() + botData.aiProvider.slice(1)}<br>` : ''}
                            ${botData.enableSearchBar ? 'Search: Enabled' : 'Search: Disabled'}
                        </div>
                    </div>
                `;
                chatWrapperMaxWidth = '700px'; // 500px chat + 200px sidebar
            }

            const chatMessagesStyle = botData.chatLayout === 'compact' ? 'padding: 10px;' : '';
            const chatInputStyle = botData.chatLayout === 'compact' ? 'padding: 10px 15px;' : '';
            const inputStyle = botData.chatLayout === 'compact' ? 'padding: 8px; font-size: 14px;' : '';
            const buttonStyle = botData.chatLayout === 'compact' ? 'padding: 8px 15px; font-size: 14px;' : '';

            if (chatbotWrapperDiv) {
                chatbotWrapperDiv.style.maxWidth = chatWrapperMaxWidth;
                chatbotWrapperDiv.innerHTML = `
                    ${sidebarHtml}
                    <div class="${chatWindowClasses}" style="border-radius: ${botData.enableBotProfile ? '0 15px 15px 0' : '15px'}; box-shadow: ${botData.enableBotProfile ? 'none' : '0 10px 30px rgba(0,0,0,0.1)'};">
                        <div class="chat-header" style="background: ${botData.themeColor || '#667eea'};">
                            <h1>${botData.headerText || botData.chatTitle || 'Chat with AI'}</h1>
                            <p>${botData.name}</p>
                            ${botData.enableBotProfile ? `
                            <button class="sidebar-toggle-btn" onclick="window.toggleSidebar()">
                                ☰ <!-- Hamburger icon -->
                            </button>
                            ` : ''}
                            <button class="new-chat-btn" onclick="window.newChat()">
                                ↺ <!-- Reload/Reset icon -->
                            </button>
                        </div>
                        ${botData.enableSearchBar ? `
                        <div class="search-bar" style="display:block;">
                            <input type="text" placeholder="Search... (not functional in demo)">
                        </div>
                        ` : ''}
                        <div class="chat-messages" id="chat-messages" style="${chatMessagesStyle}">
                            <!-- Initial welcome message added below -->
                        </div>
                        <div class="typing-indicator" id="typing-indicator" style="background:${botData.messageBotColor};">
                            <div class="typing-dots"><span></span><span></span><span></span></div>
                        </div>
                        <div class="chat-input" style="${chatInputStyle}">
                            <input type="text" id="message-input" placeholder="Type your message..." onkeypress="if(event.key==='Enter') window.sendMessage()" style="${inputStyle}">
                            <button style="background: ${botData.themeColor || '#667eea'}; ${buttonStyle}" onclick="window.sendMessage()">Send</button>
                        </div>
                    </div>
                `;
                loadingMessageDiv?.classList.add('hidden');
                chatbotWrapperDiv.classList.remove('hidden');

                // Add initial message and potentially load history
                const messagesContainer = document.getElementById('chat-messages');
                if (messagesContainer) {
                    window.addMessage('bot', botData.welcomeMessage || 'Hi! How can I help you today?');
                    if (botData.enableChatHistory) {
                        loadChatHistory(botId);
                    }
                }

                document.getElementById('message-input')?.focus();
            }

        } else {
            if (loadingMessageDiv) loadingMessageDiv.textContent = "Chatbot not found.";
            showMessage("The chatbot you are looking for does not exist.", "error");
        }
    } catch (error) {
        console.error("Error loading shared chatbot:", error);
        if (loadingMessageDiv) loadingMessageDiv.textContent = "Error loading chatbot. Please try again.";
        showMessage("An error occurred while loading the chatbot: " + error.message, "error");
    }
}

// --- Chat Functions for chat.html ---

// Function to format message content with basic markdown-like rendering
function formatMessageContent(text) {
    // 1. Code blocks (```lang...```)
    // Matches ```anything_not_newline``` and everything until ```
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const langHtml = lang ? `<span class="lang-name">${lang.toUpperCase()}</span>` : '';
        const copySvg = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-copy">
        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5c-.138 0-.25.112-.25.25v8.5c0 .138.112.25.25.25h8.5c.138 0 .25-.112.25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 10.25 16h-8.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h6.5L16 2.75V9.25A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25ZM6.75 1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25V3.75L12.25 1.5Z"></path>
        </svg>`; // A simple copy SVG for demonstration
        const copiedSvg = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check">
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>`;
        return `
            <div class="code-block-header">
                ${langHtml}
                <button class="copy-btn" onclick="window.copyCode(this)">
                    ${copySvg} <span>Copy code</span>
                </button>
            </div>
            <pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>
        `;
    });

    // 2. Inline code (`code`)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Bold (**text** or *text*)
    text = text.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');

    // 4. Italic (*text* or _text_)
    text = text.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');

    // 5. Headings (Basic # H1) - Note: Only works for H1. More complex markdown needs a parser.
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 6. Line breaks (convert \n to <br/> outside of <pre> tags)
    // This is tricky. It's safer to only convert newlines to <br> for non-code text.
    // For simplicity here, we assume lines within messages should break.
    // A proper parser handles this contextually.
    text = text.split('\n').map(line => {
        // Don't add <br> if line is part of a pre tag or already contains a block element.
        if (line.includes('<pre>') || line.includes('<h1>')) {
            return line;
        }
        return line;
    }).join('<br/>');


    return text;
}


window.addMessage = function(sender, message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    // Apply colors from currentChatbotData
    messageDiv.style.backgroundColor = sender === 'user' ? currentChatbotData.messageUserColor : currentChatbotData.messageBotColor;
    messageDiv.style.color = sender === 'user' ? currentChatbotData.messageUserTextColor : currentChatbotData.messageBotTextColor;

    messageDiv.innerHTML = `<strong>${sender === 'user' ? 'You' : 'Bot'}:</strong> ${formatMessageContent(message)}`; // Format content
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
    if (isEmbed && window.parent) {
        const container = document.getElementById('chatbot-container-wrapper'); // Get the top-level container
        if (container) {
            // Need to wait for rendering to get full height
            setTimeout(() => {
                const totalHeight = container.scrollHeight + 40; // Add some buffer
                window.parent.postMessage({ type: 'chatbot-resize', height: totalHeight }, '*'); // Adjust origin for production
            }, 50); // Small delay to allow DOM to render
        }
    }

    if (currentChatbotData?.enableChatHistory) {
        saveMessageToHistory(sender, message);
    }
};

window.showTyping = function(show) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
        if (show) {
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
};

window.sendMessage = async function() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    // Chatbot Authentication Check (CLIENT-SIDE PLACEHOLDER)
    if (currentChatbotData.requireChatbotAuth) {
        window.addMessage('bot', 'Authentication required to send messages. (Feature not implemented in client-side demo)');
        return;
    }

    window.addMessage('user', message);
    input.value = '';

    window.showTyping(true);

    try {
        const response = await callAIFromChatPage(message);
        window.showTyping(false);
        window.addMessage('bot', response || 'Sorry, I couldn\'t process that request.');
        trackChatbotUsage(currentChatbotData.id, 'message_sent');
    } catch (error) {
        window.showTyping(false);
        window.addMessage('bot', 'Error: ' + error.message);
        console.error('Error during test message on chat page:', error);
    }
};

// AI Call Logic for chat.html
async function callAIFromChatPage(message) {
    if (!currentChatbotData || !currentChatbotData.aiApiKey || !currentChatbotData.aiProvider || !currentChatbotData.aiModel) {
        throw new Error('AI API not configured for this chatbot.');
    }

    const provider = currentChatbotData.aiProvider;
    const apiKey = currentChatbotData.aiApiKey;
    const model = currentChatbotData.aiModel;
    const personality = currentChatbotData.personality;

    let apiUrl, headers, body;
    let messages = [];

    let searchResults = '';
    if (currentChatbotData.enableSearchBar && currentChatbotData.searchProvider && currentChatbotData.searchApiKey) {
        searchResults = await performSearchFromChatPage(message);
    }

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
            headers = { 'Content-Type': 'application/json' };
            body = JSON.stringify({ contents: messages }); break;
        case 'deepseek':
        case 'openai':
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
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

async function performSearchFromChatPage(query) {
    if (!currentChatbotData.searchProvider || !currentChatbotData.searchApiKey) return '';
    try {
        if (currentChatbotData.searchProvider === 'serp') {
            console.warn('SerpAPI key is exposed in the client-side code for standalone/embed. Use a backend proxy for production.');
            window.addMessage('bot', 'Search function is mocked in this standalone demo due to security. A backend is needed for real search.');
            return `[Mock Search Results for "${query}": Result 1, Result 2]`;
        }
    } catch (error) { console.error('Search failed:', error); return ''; }
    return '';
}

// --- Chat History Functions (Local Storage) ---
function saveMessageToHistory(sender, message) {
    const botId = currentChatbotData.id;
    let history = JSON.parse(localStorage.getItem(`chat_history_${botId}`)) || [];
    history.push({ sender, message, timestamp: new Date().toISOString() });
    // Limit history size to prevent excessive storage
    if (history.length > 50) { // Keep last 50 messages
        history = history.slice(history.length - 50);
    }
    localStorage.setItem(`chat_history_${botId}`, JSON.stringify(history));
    chatHistory = history; // Update in-memory history
}

function loadChatHistory(botId) {
    let history = JSON.parse(localStorage.getItem(`chat_history_${botId}`)) || [];
    chatHistory = history; // Update in-memory history
    history.forEach(msg => {
        // Skip adding the welcome message if it's already the first message in history
        if (!(msg.sender === 'bot' && msg.message === currentChatbotData.welcomeMessage && history[0] === msg)) {
             window.addMessage(msg.sender, msg.message);
        }
    });
}

function clearChatHistory(botId) {
    localStorage.removeItem(`chat_history_${botId}`);
    chatHistory = []; // Clear in-memory history
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = ''; // Clear DOM
        window.addMessage('bot', currentChatbotData.welcomeMessage || 'Hi! How can I help you today?'); // Add welcome message back
    }
}

// --- Sidebar Toggle ---
window.toggleSidebar = function() {
    const sidebar = document.getElementById('chat-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
};

// --- New Chat Button ---
window.newChat = function() {
    if (confirm('Are you sure you want to start a new chat? This will clear the current conversation history.')) {
        clearChatHistory(currentChatbotData.id);
    }
};

// --- Code Copy Button (for dynamically added code blocks) ---
window.copyCode = function(buttonElement) {
    const preElement = buttonElement.closest('.code-block-header').nextElementSibling;
    if (preElement && preElement.tagName === 'PRE') {
        const codeText = preElement.textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            const originalText = buttonElement.querySelector('span').textContent;
            const originalSvg = buttonElement.querySelector('svg').outerHTML;
            
            buttonElement.querySelector('span').textContent = 'Copied!';
            buttonElement.innerHTML = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg> <span>Copied!</span>`;

            setTimeout(() => {
                buttonElement.innerHTML = originalSvg + ` <span>${originalText}</span>`;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            showMessage('Failed to copy code.', 'error');
        });
    }
};