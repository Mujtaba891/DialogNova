// Firebase configuration (replace with your config)
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
        import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCN1cJqC0ESSdzH_gTdlIUzKRfMRDxVM2M",
  authDomain: "zen-clue.firebaseapp.com",
  projectId: "zen-clue",
  storageBucket: "zen-clue.firebasestorage.app",
  messagingSenderId: "1078835542733",
  appId: "1:1078835542733:web:fb936f7022fc1904de8784",
  measurementId: "G-231MEWNZT6"
};

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Global variables
        let currentUser = null;
        let currentChatbot = null;
        let chatbots = [];

        // IndexedDB setup for analytics
        let db_instance; // Renamed to avoid conflict with Firestore 'db'
        const request = window.indexedDB.open('ChatbotPlatform', 1); // Use window.indexedDB

        request.onupgradeneeded = function(event) {
            const db_upgrade = event.target.result; // Use a different variable name for clarity
            if (!db_upgrade.objectStoreNames.contains('chatbots_analytics')) { // Changed store name to avoid confusion
                db_upgrade.createObjectStore('chatbots_analytics', { keyPath: 'id' });
            }
            if (!db_upgrade.objectStoreNames.contains('conversations')) {
                db_upgrade.createObjectStore('conversations', { keyPath: 'id' });
            }
        };

        request.onsuccess = function(event) {
            db_instance = event.target.result; // Assign to the global db_instance
        };

        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.errorCode);
            showMessage('IndexedDB failed to open. Analytics may not work.', 'error');
        };

        // Authentication functions
        window.login = async function() {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                currentUser = userCredential.user;
                showMessage('Login successful!', 'success');
                showDashboard();
            } catch (error) {
                showMessage('Login failed: ' + error.message, 'error');
            }
        };

        window.register = async function() {
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;

            if (password !== confirm) {
                showMessage('Passwords do not match', 'error');
                return;
            }
            if (password.length < 6) {
                showMessage('Password should be at least 6 characters', 'error');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                currentUser = userCredential.user;
                showMessage('Registration successful! You are now logged in.', 'success');
                showDashboard();
            } catch (error) {
                showMessage('Registration failed: ' + error.message, 'error');
            }
        };

        window.logout = async function() {
            try {
                await signOut(auth);
                currentUser = null;
                currentChatbot = null; // Clear current chatbot on logout
                chatbots = []; // Clear chatbots list on logout
                showMessage('Logged out successfully!', 'info');
                showAuth();
            } catch (error) {
                showMessage('Logout failed: ' + error.message, 'error');
            }
        };

        window.showLogin = function() {
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
            // Clear messages when switching form
            showMessage('', 'clear');
        };

        window.showRegister = function() {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
            // Clear messages when switching form
            showMessage('', 'clear');
        };

        // UI functions
        function showAuth() {
            document.getElementById('auth-section').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            // Ensure login form is shown by default on auth screen
            showLogin();
        }

        function showDashboard() {
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            loadChatbots();
            // Show welcome message placeholder if no bot is selected initially
            document.getElementById('chatbot-editor').classList.add('hidden');
            document.getElementById('welcome-message-placeholder').classList.remove('hidden');
        }

        // Chatbot management
        window.createNewChatbot = async function() {
            const name = prompt('Enter chatbot name:');
            if (!name) return;

            const newChatbot = {
                id: Date.now().toString(), // Simple ID generation
                name: name,
                description: '',
                personality: 'You are a helpful assistant.',
                aiProvider: 'gemini', // Default provider
                aiApiKey: '',
                aiModel: 'gemini-1.0-pro', // Default model
                searchProvider: '',
                searchApiKey: '',
                themeColor: '#667eea',
                welcomeMessage: 'Hi! How can I help you today?',
                chatTitle: 'Chat with AI',
                botAvatar: '',
                subdomain: name.toLowerCase().replace(/\s+/g, '-'), // Default subdomain from name
                deploymentPassword: '',
                deployed: false,
                userId: currentUser.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, 'chatbots', newChatbot.id), newChatbot);
                chatbots.push(newChatbot);
                renderChatbots();
                selectChatbot(newChatbot.id);
                showMessage(`Chatbot "${name}" created successfully!`, 'success');
            } catch (error) {
                showMessage('Failed to create chatbot: ' + error.message, 'error');
            }
        };

        async function loadChatbots() {
            if (!currentUser) return; // Ensure user is logged in
            try {
                const q = query(collection(db, 'chatbots'), where('userId', '==', currentUser.uid));
                const querySnapshot = await getDocs(q);
                chatbots = [];
                querySnapshot.forEach((doc) => {
                    chatbots.push({ id: doc.id, ...doc.data() });
                });
                renderChatbots();
            } catch (error) {
                console.error('Failed to load chatbots:', error);
                showMessage('Failed to load your chatbots. Please try again.', 'error');
            }
        }

        function renderChatbots() {
            const listElement = document.getElementById('chatbot-list');
            listElement.innerHTML = ''; // Clear existing list

            if (chatbots.length === 0) {
                listElement.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No chatbots created yet. Click "Create New Chatbot"!</p>';
                return;
            }

            chatbots.forEach(bot => {
                const item = document.createElement('div');
                item.className = 'chatbot-item';
                item.setAttribute('data-id', bot.id); // Add data-id for selection
                item.onclick = () => selectChatbot(bot.id);
                item.innerHTML = `
                    <h3>${bot.name}</h3>
                    <p>${bot.description || 'No description'}</p>
                    <p><small>Created: ${new Date(bot.createdAt).toLocaleDateString()}</small></p>
                `;
                listElement.appendChild(item);
            });
        }

        function selectChatbot(id) {
            currentChatbot = chatbots.find(bot => bot.id === id);
            if (!currentChatbot) {
                showMessage('Chatbot not found.', 'error');
                return;
            }

            // Update UI - remove active from all, add to selected
            document.querySelectorAll('.chatbot-item').forEach(item => {
                item.classList.remove('active');
            });
            const selectedItem = document.querySelector(`.chatbot-item[data-id="${id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }

            // Show editor and hide welcome message
            document.getElementById('welcome-message-placeholder').classList.add('hidden');
            document.getElementById('chatbot-editor').classList.remove('hidden');

            // Populate form fields
            populateFormFields();
            switchTab('basic'); // Auto-switch to basic settings when selecting a bot
            // Clear test chat preview
            const chatPreview = document.getElementById('chat-preview');
            chatPreview.innerHTML = `
                <div class="message bot">
                    <strong>Bot:</strong> <span id="initial-welcome-message-preview">${currentChatbot.welcomeMessage}</span>
                </div>
            `;
        }

        function populateFormFields() {
            if (!currentChatbot) return;

            document.getElementById('bot-name').value = currentChatbot.name || '';
            document.getElementById('bot-description').value = currentChatbot.description || '';
            document.getElementById('bot-personality').value = currentChatbot.personality || 'You are a helpful assistant.';
            document.getElementById('ai-provider').value = currentChatbot.aiProvider || '';
            document.getElementById('ai-api-key').value = currentChatbot.aiApiKey || '';
            document.getElementById('search-provider').value = currentChatbot.searchProvider || '';
            document.getElementById('search-api-key').value = currentChatbot.searchApiKey || '';
            document.getElementById('theme-color').value = currentChatbot.themeColor || '#667eea';
            document.getElementById('welcome-message-text').value = currentChatbot.welcomeMessage || 'Hi! How can I help you today?'; // Use new ID
            document.getElementById('chat-title').value = currentChatbot.chatTitle || 'Chat with AI';
            document.getElementById('bot-avatar').value = currentChatbot.botAvatar || '';
            document.getElementById('subdomain').value = currentChatbot.subdomain || '';
            document.getElementById('deployment-password').value = currentChatbot.deploymentPassword || '';

            // Update the subdomain preview immediately
            document.getElementById('subdomain-preview').textContent = `${document.getElementById('subdomain').value || 'my-chatbot'}.dialog-nova.vercel.app`;

            // Update API model options and select current model
            updateAPIFields();
            document.getElementById('ai-model').value = currentChatbot.aiModel || '';

            // Update deployment status info if deployed
            if (currentChatbot.deployed) {
                document.getElementById('deployment-status').classList.remove('hidden');
                document.getElementById('deploy-status').textContent = 'Deployed';
                document.getElementById('deployed-url').href = `https://${currentChatbot.subdomain}.dialog-nova.vercel.app`;
                document.getElementById('deployed-url').textContent = `https://${currentChatbot.subdomain}.dialog-nova.vercel.app`;
                document.getElementById('last-updated').textContent = new Date(currentChatbot.updatedAt).toLocaleString();
            } else {
                document.getElementById('deployment-status').classList.add('hidden');
            }
        }

        // Tab switching
        window.switchTab = function(tabName) {
            document.querySelectorAll('.tabs .tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            document.querySelector(`.tabs .tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');

            // Clear messages when switching tabs
            showMessage('', 'clear');
        };

        // API configuration
        window.updateAPIFields = function() {
            const provider = document.getElementById('ai-provider').value;
            const modelSelect = document.getElementById('ai-model');

            modelSelect.innerHTML = '<option value="">Select Model</option>'; // Reset options

            switch(provider) {
                case 'gemini':
                    modelSelect.innerHTML += `
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                    `;
                    break;
                case 'deepseek':
                    modelSelect.innerHTML += `
                        <option value="deepseek/deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek/deepseek-coder">DeepSeek Coder</option>
                    `;
                    break;
                case 'openai':
                    modelSelect.innerHTML += `
                        <option value="openai/gpt-4">GPT-4</option>
                        <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    `;
                    break;
            }
            // Set the selected model if it exists in currentChatbot after populating
            if (currentChatbot && currentChatbot.aiModel) {
                modelSelect.value = currentChatbot.aiModel;
            }
        };

        // Save functions
        window.saveBasicSettings = async function() {
            if (!currentChatbot) {
                showMessage('No chatbot selected. Please create or select one.', 'error');
                return;
            }

            currentChatbot.name = document.getElementById('bot-name').value;
            currentChatbot.description = document.getElementById('bot-description').value;
            currentChatbot.personality = document.getElementById('bot-personality').value;
            currentChatbot.updatedAt = new Date().toISOString();

            await updateChatbot();
            showMessage('Basic settings saved successfully!', 'success');
        };

        window.saveAPISettings = async function() {
            if (!currentChatbot) {
                showMessage('No chatbot selected. Please create or select one.', 'error');
                return;
            }

            currentChatbot.aiProvider = document.getElementById('ai-provider').value;
            currentChatbot.aiApiKey = document.getElementById('ai-api-key').value;
            currentChatbot.aiModel = document.getElementById('ai-model').value;
            currentChatbot.searchProvider = document.getElementById('search-provider').value;
            currentChatbot.searchApiKey = document.getElementById('search-api-key').value;
            currentChatbot.updatedAt = new Date().toISOString();

            await updateChatbot();
            showMessage('API settings saved successfully!', 'success');
        };

        window.saveCustomization = async function() {
            if (!currentChatbot) {
                showMessage('No chatbot selected. Please create or select one.', 'error');
                return;
            }

            currentChatbot.themeColor = document.getElementById('theme-color').value;
            currentChatbot.welcomeMessage = document.getElementById('welcome-message-text').value; // Use new ID
            currentChatbot.chatTitle = document.getElementById('chat-title').value;
            currentChatbot.botAvatar = document.getElementById('bot-avatar').value;
            currentChatbot.updatedAt = new Date().toISOString();

            await updateChatbot();
            showMessage('Customization saved successfully!', 'success');
            // Update preview welcome message immediately
            document.getElementById('initial-welcome-message-preview').textContent = currentChatbot.welcomeMessage;
        };

        async function updateChatbot() {
            if (!currentChatbot) return; // Should not happen if checks are in place
            try {
                await updateDoc(doc(db, 'chatbots', currentChatbot.id), currentChatbot);
                // Update local chatbots array
                const index = chatbots.findIndex(bot => bot.id === currentChatbot.id);
                if (index !== -1) {
                    chatbots[index] = { ...currentChatbot };
                }
                renderChatbots(); // Re-render list to reflect name changes etc.
            } catch (error) {
                showMessage('Failed to save chatbot: ' + error.message, 'error');
                console.error('Error updating chatbot:', error);
            }
        }

        // Testing functions
        window.testAPIConnection = async function() {
            if (!currentChatbot || !currentChatbot.aiProvider || !currentChatbot.aiApiKey || !currentChatbot.aiModel) {
                showMessage('Please configure AI Provider, API Key, and Model in API Configuration tab first.', 'error');
                return;
            }

            showMessage('Testing API connection...', 'info');

            try {
                // Use a simple, non-conversational message for connection test
                const response = await callAI('Hello, this is a test message. Respond with "API OK".', true); // Pass true to indicate it's a test
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

            // Add user message to chat
            addMessageToChat('user', message);
            input.value = '';

            // Show typing indicator
            showTypingInPreview(true);

            // Get bot response
            try {
                const response = await callAI(message);
                showTypingInPreview(false);
                addMessageToChat('bot', response || 'Sorry, I couldn\'t process that request.');
                trackChatbotUsage(currentChatbot.id, 'message_sent'); // Track usage
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
            messageDiv.innerHTML = `<strong>${sender === 'user' ? 'You' : 'Bot'}:</strong> ${message}`;
            chatPreview.appendChild(messageDiv);
            chatPreview.scrollTop = chatPreview.scrollHeight;
        }

        function showTypingInPreview(show) {
            // For the dashboard preview, we can just use a simple message or hide/show a div
            // No dedicated typing indicator in current preview HTML, so simulate by text.
            // A more advanced preview would have a dedicated indicator.
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

        // Placeholder for search function in dashboard
        async function performSearch(query) {
            if (!currentChatbot.searchProvider || !currentChatbot.searchApiKey) return '';

            if (currentChatbot.searchProvider === 'serp') {
                // WARNING: Directly calling SerpAPI from client-side JavaScript exposes your API key
                // and is subject to CORS restrictions. For a production app, you MUST
                // route this through a backend server.
                console.warn('SerpAPI key is exposed in the client-side code and subject to CORS. Use a backend proxy for production.');
                showMessage('Search integration with SerpAPI requires a backend proxy due to API key security and CORS. Mocking search results for preview.', 'info');
                return `[Mock Search Results for "${query}": Result 1, Result 2]`; // Mock response for preview
                /*
                // Example of actual call (will likely fail due to CORS)
                const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${currentChatbot.searchApiKey}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`SerpAPI failed: ${response.status} - ${errorData.error || response.statusText}`);
                }
                const data = await response.json();
                return data.organic_results?.slice(0, 3).map(r => r.title + ': ' + r.snippet).join('\n') || '';
                */
            }
            // Add other search providers here if implemented
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

            // Add search capability if configured and not just a connection test
            let searchResults = '';
            if (!isTestConnection && currentChatbot.searchProvider && currentChatbot.searchApiKey) {
                searchResults = await performSearch(message);
            }

            // Construct the prompt based on provider and search results
            if (provider === 'gemini') {
                // Gemini combines personality into the first user message or part
                let geminiPrompt = personality;
                if (searchResults) {
                    geminiPrompt += `\n\nSearch Results: ${searchResults}`;
                }
                geminiPrompt += `\n\nUser: ${message}`;
                messages.push({
                    parts: [{ text: geminiPrompt }]
                });
            } else { // For Deepseek, OpenAI (OpenRouter)
                messages.push({ role: 'system', content: personality });
                let userContent = message;
                if (searchResults) {
                    userContent = `Search Results: ${searchResults}\n\n${message}`;
                }
                messages.push({ role: 'user', content: userContent });
            }


            switch (provider) {
                case 'gemini':
                    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    headers = {
                        'Content-Type': 'application/json',
                    };
                    body = JSON.stringify({
                        contents: messages
                    });
                    break;

                case 'deepseek':
                case 'openai':
                    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
                    headers = {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    };
                    body = JSON.stringify({
                        model: model,
                        messages: messages,
                        // Optional: stream: true for streaming responses
                    });
                    break;

                default:
                    throw new Error('Unsupported AI provider');
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.error || response.statusText;
                throw new Error(`API call failed: ${response.status} - ${errorMessage}`);
            }

            const data = await response.json();

            // Parse response based on provider
            switch (provider) {
                case 'gemini':
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
                case 'deepseek':
                case 'openai':
                    return data.choices?.[0]?.message?.content || 'No response';
                default:
                    return 'Unknown response format';
            }
        }

        // Deployment functions
        window.deployChatbot = async function() {
            if (!currentChatbot) {
                showMessage('No chatbot selected. Please create or select one to deploy.', 'error');
                return;
            }

            const subdomain = document.getElementById('subdomain').value.trim();
            if (!subdomain) {
                showMessage('Please enter a subdomain for deployment.', 'error');
                return;
            }

            // Basic subdomain validation (alphanumeric, hyphens allowed)
            if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
                showMessage('Invalid subdomain format. Use lowercase letters, numbers, and hyphens only. Must start and end with alphanumeric characters.', 'error');
                return;
            }

            // In a real application, you would check for subdomain availability on your backend
            // and then perform the actual deployment (e.g., creating files on a server,
            // configuring DNS, etc.). For this client-side demo, we'll simulate it.
            showMessage('Deploying chatbot... (This is a simulated deployment for client-side demo)', 'info', 7000);


            currentChatbot.subdomain = subdomain;
            currentChatbot.deploymentPassword = document.getElementById('deployment-password').value; // Keep it on client side for now
            currentChatbot.deployed = true;
            currentChatbot.updatedAt = new Date().toISOString();

            await updateChatbot(); // Save updated deployment status to Firestore

            // Show deployment status in UI
            document.getElementById('deployment-status').classList.remove('hidden');
            document.getElementById('deploy-status').textContent = 'Deployed';
            document.getElementById('deployed-url').href = `https://${subdomain}.dialog-nova.vercel.app`;
            document.getElementById('deployed-url').textContent = `https://${subdomain}.dialog-nova.vercel.app`;
            document.getElementById('last-updated').textContent = new Date().toLocaleString();

            showMessage('Chatbot deployed successfully! (Simulated)', 'success');
            trackChatbotUsage(currentChatbot.id, 'deployed');
        };

        window.generateEmbedCode = function() {
            if (!currentChatbot || !currentChatbot.deployed || !currentChatbot.subdomain) {
                showMessage('Please deploy your chatbot first to generate embed code.', 'error');
                return;
            }

            const embedCode = `<iframe
    src="https://${currentChatbot.subdomain}.dialog-nova.vercel.app/embed"
    width="400"
    height="600"
    frameborder="0"
    style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</iframe>

<script>
    // Optional: Customize embed behavior
    window.addEventListener('message', function(event) {
        if (event.origin !== 'https://${currentChatbot.subdomain}.dialog-nova.vercel.app') return;

        if (event.data.type === 'chatbot-resize') {
            const iframe = document.querySelector('iframe[src*="${currentChatbot.subdomain}"]');
            if (iframe) {
                iframe.style.height = event.data.height + 'px';
            }
        }
    });
</script>`;

            document.getElementById('embed-code').value = embedCode;
            document.getElementById('embed-code-section').classList.remove('hidden');
            showMessage('Embed code generated!', 'info');
        };

        window.copyEmbedCode = function() {
            const embedCode = document.getElementById('embed-code');
            embedCode.select();
            document.execCommand('copy');
            showMessage('Embed code copied to clipboard!', 'success');
        };

        // Utility functions
        function showMessage(message, type = 'info', duration = 5000) {
            const container = document.querySelector('.main-content'); // Place messages in main content area
            if (!container) return;

            // Clear previous messages if not specifically clearing all
            if (type === 'clear') {
                document.querySelectorAll('.app-message').forEach(msg => msg.remove());
                return;
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = `app-message ${type}-message`; // Use a common class 'app-message'
            messageDiv.textContent = message;

            // Prepend message to the top of the main content area
            container.insertBefore(messageDiv, container.firstChild);

            // Auto-remove after duration
            setTimeout(() => {
                messageDiv.remove();
            }, duration);
        }


        // Subdomain preview update
        document.getElementById('subdomain').addEventListener('input', function() {
            const subdomain = this.value || 'my-chatbot';
            document.getElementById('subdomain-preview').textContent = `${subdomain.toLowerCase().replace(/\s+/g, '-')}.dialog-nova.vercel.app`;
        });

        // Initialize app
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                showDashboard();
            } else {
                currentUser = null;
                showAuth();
            }
        });

        // Generate standalone chatbot HTML
        window.generateStandaloneChatbot = function() {
            if (!currentChatbot) {
                showMessage('No chatbot selected. Please create or select one.', 'error');
                return;
            }

            // Important Security Warning:
            // This standalone HTML includes your AI API key directly in the client-side code.
            // This is a significant security risk for production applications as it exposes your key.
            // For a real-world scenario, AI API calls should always be proxied through a secure backend server
            // to protect your API keys and apply rate limiting/access control.
            showMessage('WARNING: Standalone HTML includes API keys directly. This is a security risk for production! Use a backend proxy for secure deployment.', 'error', 10000);


            const standaloneHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentChatbot.chatTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, ${currentChatbot.themeColor} 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .chat-container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
            height: 600px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .chat-header {
            background: ${currentChatbot.themeColor};
            color: white;
            padding: 20px;
            text-align: center;
        }

        .chat-header h1 {
            font-size: 1.2em;
            margin-bottom: 5px;
        }

        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: #f8f9fa;
        }

        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 18px;
            max-width: 80%;
            word-wrap: break-word;
        }

        .message.user {
            background: ${currentChatbot.themeColor};
            color: white;
            margin-left: auto;
            text-align: right;
        }

        .message.bot {
            background: #e9ecef;
            color: #333;
            margin-right: auto; /* Ensure bot messages align left */
        }

        .chat-input {
            display: flex;
            padding: 20px;
            background: white;
            border-top: 1px solid #eee;
        }

        .chat-input input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 25px;
            font-size: 16px;
            outline: none;
        }

        .chat-input input:focus {
            border-color: ${currentChatbot.themeColor};
        }

        .chat-input button {
            background: ${currentChatbot.themeColor};
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            margin-left: 10px;
            cursor: pointer;
            font-size: 16px;
        }

        .chat-input button:hover {
            opacity: 0.9;
        }

        .typing-indicator {
            display: none;
            padding: 10px 15px;
            background: #e9ecef;
            border-radius: 18px;
            max-width: 80%;
            margin-bottom: 15px;
            margin-right: auto; /* Ensure it aligns left */
        }

        .typing-dots {
            display: flex;
            gap: 3px;
        }

        .typing-dots span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #666;
            animation: typing 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.5;
            }
            30% {
                transform: translateY(-10px);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h1>${currentChatbot.chatTitle}</h1>
            <p>${currentChatbot.name}</p>
        </div>

        <div class="chat-messages" id="chat-messages">
            <div class="message bot">
                ${currentChatbot.welcomeMessage}
            </div>
        </div>

        <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>

        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Type your message..." onkeypress="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        const chatbotConfig = {
            aiProvider: '${currentChatbot.aiProvider}',
            aiApiKey: '${currentChatbot.aiApiKey}',
            aiModel: '${currentChatbot.aiModel}',
            personality: \`${currentChatbot.personality.replace(/`/g, '\\`')}\`, // Escape backticks for template literals
            searchProvider: '${currentChatbot.searchProvider}',
            searchApiKey: '${currentChatbot.searchApiKey}'
        };

        async function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            if (!message) return;

            // Add user message
            addMessage('user', message);
            input.value = '';

            // Show typing indicator
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
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;
            messageDiv.textContent = message;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTyping(show) {
            const indicator = document.getElementById('typing-indicator');
            indicator.style.display = show ? 'block' : 'none';
            if (show) {
                document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
            }
        }

        // AI Call Logic for Standalone Chatbot
        async function callAI(message) {
            if (!chatbotConfig.aiApiKey || !chatbotConfig.aiProvider || !chatbotConfig.aiModel) {
                throw new Error('AI API not configured');
            }

            const provider = chatbotConfig.aiProvider;
            const apiKey = chatbotConfig.aiApiKey;
            const model = chatbotConfig.aiModel;
            const personality = chatbotConfig.personality;

            let apiUrl, headers, body;
            let messages = [];

            // Add search capability if configured
            let searchResults = '';
            if (chatbotConfig.searchProvider && chatbotConfig.searchApiKey) {
                searchResults = await performSearch(message);
            }

            if (provider === 'gemini') {
                let geminiPrompt = personality;
                if (searchResults) {
                    geminiPrompt += \`\\n\\nSearch Results: \${searchResults}\`;
                }
                geminiPrompt += \`\\n\\nUser: \${message}\`;
                messages.push({
                    parts: [{ text: geminiPrompt }]
                });
            } else { // For Deepseek, OpenAI (OpenRouter)
                messages.push({ role: 'system', content: personality });
                let userContent = message;
                if (searchResults) {
                    userContent = \`Search Results: \${searchResults}\\n\\n\${message}\`;
                }
                messages.push({ role: 'user', content: userContent });
            }

            // Call appropriate AI API based on provider
            switch (provider) {
                case 'gemini':
                    apiUrl = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`;
                    headers = {
                        'Content-Type': 'application/json',
                    };
                    body = JSON.stringify({
                        contents: messages
                    });
                    break;
                case 'deepseek':
                case 'openai':
                    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
                    headers = {
                        'Authorization': \`Bearer \${apiKey}\`,
                        'Content-Type': 'application/json',
                    };
                    body = JSON.stringify({
                        model: model,
                        messages: messages
                    });
                    break;
                default:
                    throw new Error('Unsupported AI provider');
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.error || response.statusText;
                throw new Error(\`API call failed: \${response.status} - \${errorMessage}\`);
            }

            const data = await response.json();

            switch (provider) {
                case 'gemini':
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
                case 'deepseek':
                case 'openai':
                    return data.choices?.[0]?.message?.content || 'No response';
                default:
                    return 'Unknown response format';
            }
        }

        // Search function for Standalone Chatbot
        async function performSearch(query) {
            if (!chatbotConfig.searchProvider || !chatbotConfig.searchApiKey) return '';

            try {
                if (chatbotConfig.searchProvider === 'serp') {
                    // WARNING: Exposing API keys in client-side code is a security risk.
                    // For production, these calls should be proxied through a backend.
                    console.warn('SerpAPI key is exposed in the client-side code. Use a backend proxy for production.');
                    const response = await fetch(\`https://serpapi.com/search.json?q=\${encodeURIComponent(query)}&api_key=\${chatbotConfig.searchApiKey}\`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(\`SerpAPI failed: \${response.status} - \${errorData.error || response.statusText}\`);
                    }
                    const data = await response.json();
                    return data.organic_results?.slice(0, 3).map(r => r.title + ': ' + r.snippet).join('\\n') || '';
                }
                // Add other search providers here
            } catch (error) {
                console.error('Search failed:', error);
                return '';
            }
            return '';
        }

        // Initialize chat
        document.getElementById('message-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Auto-focus input
        document.getElementById('message-input').focus();
    </script>
</body>
</html>`;

            // Create download link
            const blob = new Blob([standaloneHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentChatbot.name.replace(/\s+/g, '-').toLowerCase()}-chatbot.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showMessage('Standalone chatbot HTML downloaded!', 'success');
        };

        // Add download button to deploy tab
        document.addEventListener('DOMContentLoaded', () => {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn btn-secondary';
            downloadBtn.textContent = 'Download Standalone HTML';
            downloadBtn.onclick = generateStandaloneChatbot;
            const downloadSection = document.getElementById('standalone-download-section');
            if (downloadSection) {
                downloadSection.appendChild(downloadBtn);
            }
        });


        // Analytics tracking (basic implementation)
        window.trackChatbotUsage = function(chatbotId, action) {
            const usage = {
                chatbotId: chatbotId,
                action: action,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            // Store in IndexedDB for analytics
            if (db_instance) { // Use the corrected db_instance
                const transaction = db_instance.transaction(['conversations'], 'readwrite');
                const store = transaction.objectStore('conversations');
                store.add({ id: Date.now() + Math.random(), ...usage })
                    .onsuccess = () => console.log('Usage tracked:', usage);
                transaction.onerror = (event) => console.error('Error tracking usage:', event.target.error);
            } else {
                console.warn('IndexedDB not ready. Usage not tracked.');
            }
        };