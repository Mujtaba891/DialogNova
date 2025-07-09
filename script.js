// Firebase configuration (replace with your config)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCN1cJqC0ESSdzH_gTdlIUzKRfMRDxVM2M",
    authDomain: "zen-clue.firebaseapp.com",
    projectId: "zen-clue",
    storageBucket: "zen-clue.firebasestorage.app",
    messagingSenderId: "1078835542733",
    appId: "1:1078835542733:web:fb936f7022fc1904de8784",
    measurementId: "G-231MEWNZT6"
};

// --- CRITICAL SECURITY WARNING ---
// For any real-world application, Firebase API keys for public-facing web apps should be restricted.
// More importantly, any sensitive API keys (e.g., for AI models, search) should NEVER be
// directly exposed in client-side code like this. They MUST be routed through a secure
// backend proxy. This setup is for demonstration purposes only.
console.warn("SECURITY WARNING: This is a client-side only demo. In a production environment, API keys (especially for AI/Search services) should be managed by a secure backend proxy, not exposed directly in frontend code.");
// --- END CRITICAL SECURITY WARNING ---

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Global variables
export let currentUser = null;
let chatbots = [];

// --- PWA Service Worker Registration (for the main platform app) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// --- IndexedDB Setup for Analytics ---
export let db_instance;
const request = window.indexedDB.open('ChatbotPlatform', 1);

request.onupgradeneeded = function(event) {
    const db_upgrade = event.target.result;
    if (!db_upgrade.objectStoreNames.contains('chatbots_analytics')) {
        db_upgrade.createObjectStore('chatbots_analytics', { keyPath: 'id' });
    }
    if (!db_upgrade.objectStoreNames.contains('conversations')) {
        db_upgrade.createObjectStore('conversations', { keyPath: 'id' });
    }
};

request.onsuccess = function(event) {
    db_instance = event.target.result;
};

request.onerror = function(event) {
    console.error("IndexedDB error:", event.target.errorCode);
    showMessage('IndexedDB failed to open. Analytics may not work.', 'error');
};


// --- Authentication Functions ---
window.login = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage('Login successful!', 'success');
        window.location.href = 'dashboard.html';
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
        await createUserWithEmailAndPassword(auth, email, password);
        showMessage('Registration successful! You are now logged in.', 'success');
        window.location.href = 'dashboard.html';
    } catch (error) {
        showMessage('Registration failed: ' + error.message, 'error');
    }
};

window.signInWithGoogle = async function() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        showMessage('Signed in with Google!', 'success');
        window.location.href = 'dashboard.html';
    } catch (error) {
        showMessage('Google sign-in failed: ' + error.message, 'error');
        console.error("Google sign-in error:", error);
    }
};

window.logout = async function() {
    try {
        await signOut(auth);
        currentUser = null;
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('selectedChatbotId');
        showMessage('Logged out successfully!', 'info');
        window.location.href = 'auth.html';
    } catch (error) {
        showMessage('Logout failed: ' + error.message, 'error');
    }
};

window.showLogin = function() {
    document.getElementById('login-form')?.classList.remove('hidden');
    document.getElementById('register-form')?.classList.add('hidden');
    showMessage('', 'clear');
};

window.showRegister = function() {
    document.getElementById('login-form')?.classList.add('hidden');
    document.getElementById('register-form')?.classList.remove('hidden');
    showMessage('', 'clear');
};

// --- User State Management & Header UI Update ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        localStorage.setItem('currentUserId', user.uid);
    } else {
        localStorage.removeItem('currentUserId');
    }
    updateHeaderAuthUI(user);

    initializePageContent(); // Call page-specific initialization after auth state is known
});

function updateHeaderAuthUI(user) {
    const loginSignupBtn = document.getElementById('login-signup-btn');
    const userProfileWidget = document.getElementById('user-profile-widget');
    const userEmailDisplay = document.getElementById('user-email-display');
    const profilePic = document.getElementById('profile-pic');

    if (loginSignupBtn && userProfileWidget) {
        if (user) {
            loginSignupBtn.classList.add('hidden');
            userProfileWidget.classList.remove('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            if (profilePic) profilePic.src = user.photoURL || 'https://via.placeholder.com/40';
        } else {
            loginSignupBtn.classList.remove('hidden');
            userProfileWidget.classList.add('hidden');
        }
    }
}

// --- Page Initialization (Router-like behavior) ---
async function initializePageContent() {
    const path = window.location.pathname;

    if (path.includes('auth.html')) {
        // Auth page logic - handled by specific auth.html scripts
    } else if (path.includes('index.html') || path === '/') {
        // Home page logic - UI updates for auth status handled by updateHeaderAuthUI
    } else if (path.includes('dashboard.html')) {
        if (currentUser) {
            loadChatbotsForDashboard();
            displayUserProfile();
        } else {
            showMessage("You must be logged in to view the dashboard.", "error");
            window.location.href = 'auth.html';
        }
    } else if (path.includes('editor.html')) {
        if (currentUser) {
            const { initEditorPage } = await import('./editor.js');
            initEditorPage();
        } else {
            showMessage("You must be logged in to edit chatbots.", "error");
            window.location.href = 'auth.html';
        }
    } else if (path.includes('bots.html')) {
        loadPublicAndMyBots();
    } else if (path.includes('chat.html')) {
        const { initChatPage } = await import('./chat.js');
        initChatPage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged will trigger initializePageContent after checking auth state
});


// --- Dashboard Functions ---
async function loadChatbotsForDashboard() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, 'chatbots'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        chatbots = [];
        querySnapshot.forEach((doc) => {
            chatbots.push({ id: doc.id, ...doc.data() });
        });
        renderChatbotsList();

        const lastSelectedId = localStorage.getItem('selectedChatbotId');
        if (lastSelectedId && chatbots.some(bot => bot.id === lastSelectedId)) {
            selectChatbotForDashboard(lastSelectedId);
        } else {
            document.getElementById('chatbot-editor')?.classList.add('hidden');
            document.getElementById('welcome-message-placeholder')?.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load chatbots for dashboard:', error);
        showMessage('Failed to load your chatbots. Please try again.', 'error');
    }
}

function renderChatbotsList() {
    const listElement = document.getElementById('chatbot-list');
    if (!listElement) return;

    listElement.innerHTML = '';
    if (chatbots.length === 0) {
        listElement.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No chatbots created yet. Click "Create New Chatbot"!</p>';
        return;
    }

    chatbots.forEach(bot => {
        const item = document.createElement('div');
        item.className = 'chatbot-item';
        item.setAttribute('data-id', bot.id);
        item.onclick = () => selectChatbotForDashboard(bot.id);
        item.innerHTML = `
            <h3>${bot.name}</h3>
            <p>${bot.description || 'No description'}</p>
            <p><small>Created: ${new Date(bot.createdAt).toLocaleDateString()}</small></p>
        `;
        listElement.appendChild(item);
    });
}

function selectChatbotForDashboard(id) {
    const selectedBot = chatbots.find(bot => bot.id === id);
    if (!selectedBot) {
        showMessage('Chatbot not found.', 'error');
        return;
    }
    localStorage.setItem('selectedChatbotId', id);

    document.querySelectorAll('.chatbot-item').forEach(item => {
        item.classList.remove('active');
    });
    const selectedItem = document.querySelector(`.chatbot-item[data-id="${id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    document.getElementById('welcome-message-placeholder')?.classList.add('hidden');
    document.getElementById('chatbot-editor')?.classList.remove('hidden');
    document.getElementById('selected-bot-name').textContent = selectedBot.name;
    document.getElementById('selected-bot-description').textContent = selectedBot.description || 'No description provided.';
}

window.createNewChatbot = async function() {
    if (!currentUser) {
        showMessage("Please log in to create a chatbot.", "error");
        return;
    }
    const name = prompt('Enter chatbot name:');
    if (!name) return;

    const newChatbot = {
        id: Date.now().toString(),
        name: name,
        description: '',
        personality: 'You are a helpful assistant.',
        aiProvider: 'gemini',
        aiApiKey: '',
        aiModel: 'gemini-1.0-pro',
        searchProvider: '',
        searchApiKey: '',
        themeColor: '#667eea',
        welcomeMessage: 'Hi! How can I help you today?',
        chatTitle: 'Chat with AI',
        botAvatar: '',
        splashText: 'Loading your AI...',
        headerText: 'Chat with AI',
        chatLayout: 'default',
        enableChatHistory: true,
        enableSearchBar: false,
        enableBotProfile: false,
        requireChatbotAuth: false,
        messageUserColor: '#007bff',
        messageBotColor: '#e9ecef',
        messageUserTextColor: '#ffffff',
        messageBotTextColor: '#333333',
        subdomain: name.toLowerCase().replace(/\s+/g, '-').substring(0, 20),
        deploymentPassword: '',
        deployed: false,
        isPublic: false,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'chatbots', newChatbot.id), newChatbot);
        chatbots.push(newChatbot);
        renderChatbotsList();
        showMessage(`Chatbot "${name}" created successfully! Redirecting to editor...`, 'success');
        localStorage.setItem('selectedChatbotId', newChatbot.id);
        window.location.href = `editor.html?id=${newChatbot.id}`;
    } catch (error) {
        showMessage('Failed to create chatbot: ' + error.message, 'error');
    }
};

window.goToEditor = function() {
    const selectedBotId = localStorage.getItem('selectedChatbotId');
    if (selectedBotId) {
        window.location.href = `editor.html?id=${selectedBotId}`;
    } else {
        showMessage('Please select a chatbot first to edit.', 'info');
    }
};

window.deleteChatbot = async function() {
    const selectedBotId = localStorage.getItem('selectedChatbotId');
    const botToDelete = chatbots.find(bot => bot.id === selectedBotId);

    if (!selectedBotId || !botToDelete || !confirm(`Are you sure you want to delete "${botToDelete.name}"? This cannot be undone.`)) {
        return;
    }
    try {
        await deleteDoc(doc(db, 'chatbots', selectedBotId));
        chatbots = chatbots.filter(bot => bot.id !== selectedBotId);
        localStorage.removeItem('selectedChatbotId');
        renderChatbotsList();
        document.getElementById('chatbot-editor')?.classList.add('hidden');
        document.getElementById('welcome-message-placeholder')?.classList.remove('hidden');
        showMessage('Chatbot deleted successfully!', 'success');
    } catch (error) {
        showMessage('Failed to delete chatbot: ' + error.message, 'error');
    }
};

function displayUserProfile() {
    if (currentUser) {
        document.getElementById('profile-email').textContent = currentUser.email;
        document.getElementById('profile-last-login').textContent = currentUser.metadata.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleString() : 'N/A';
    }
}


// --- Explore Bots Page Functions ---
window.filterBots = async function(filterType) {
    document.querySelectorAll('.filter-controls .btn').forEach(btn => btn.classList.remove('active', 'btn')); // Remove active and default btn style
    document.querySelectorAll('.filter-controls .btn').forEach(btn => btn.classList.add('btn-secondary')); // Add secondary to all
    document.getElementById(`filter-${filterType}-bots`)?.classList.add('active'); // Add active to selected
    document.getElementById(`filter-${filterType}-bots`)?.classList.remove('btn-secondary'); // Remove secondary from selected
    document.getElementById(`filter-${filterType}-bots`)?.classList.add('btn'); // Ensure it has primary btn style

    const botsListContainer = document.getElementById('bots-list-container');
    if (!botsListContainer) return;
    botsListContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 50px;">Loading bots...</p>';

    let q;
    try {
        if (filterType === 'my') {
            if (!currentUser) {
                botsListContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 50px;">Please log in to see your bots.</p>';
                showMessage("Log in to view your personal chatbots.", "info");
                return;
            }
            q = query(collection(db, 'chatbots'), where('userId', '==', currentUser.uid));
        } else {
            q = query(collection(db, 'chatbots'), where('isPublic', '==', true));
        }

        const querySnapshot = await getDocs(q);
        const fetchedBots = [];
        querySnapshot.forEach((doc) => {
            fetchedBots.push({ id: doc.id, ...doc.data() });
        });

        renderBotsList(fetchedBots, filterType);
        trackChatbotUsage('platform', `view_bots_page_${filterType}`); // Track viewing of bot lists

    } catch (error) {
        console.error('Failed to load bots:', error);
        showMessage('Failed to load bots. Please try again.', 'error');
        botsListContainer.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 50px;">Error loading bots.</p>';
    }
};

function renderBotsList(botsToRender, filterType) {
    const botsListContainer = document.getElementById('bots-list-container');
    if (!botsListContainer) return;
    botsListContainer.innerHTML = '';

    if (botsToRender.length === 0) {
        botsListContainer.innerHTML = `<p style="text-align: center; color: #666; padding: 50px;">No ${filterType === 'my' ? 'bots found for your account.' : 'public bots available.'}</p>`;
        return;
    }

    botsToRender.forEach(bot => {
        const botCard = document.createElement('div');
        botCard.className = 'bot-card';
        botCard.innerHTML = `
            <h3>${bot.name}</h3>
            <p>${bot.description || 'No description provided.'}</p>
            <div class="bot-meta">
                <span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="color: #667eea; vertical-align: middle;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.38 0 2.5 1.12 2.5 2.5S13.38 10 12 10s-2.5-1.12-2.5-2.5S10.62 5 12 5zm0 14.5c-2.49 0-4.63-1.63-5.46-3.88.04-1.28 2.5-2.07 5.46-2.07s5.42.79 5.46 2.07c-.83 2.25-2.97 3.88-5.46 3.88z"/>
                    </svg>
                    ${bot.aiProvider ? bot.aiProvider.charAt(0).toUpperCase() + bot.aiProvider.slice(1) : 'Unknown AI'}
                </span>
                <span>
                    <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 0 24 24" width="16px" fill="currentColor" style="color: ${bot.isPublic ? '#28a745' : '#6c757d'}; vertical-align: middle;">
                        ${bot.isPublic ? '<path d="M0 0h24v24H0z" fill="none"/><path d="M12 4.5c-3.86 0-7 3.14-7 7s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm-3-5c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z"/>' : '<path d="M0 0h24v24H0z" fill="none"/><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>'}
                    </svg>
                    ${bot.isPublic ? 'Public' : 'Private'}
                </span>
            </div>
            <a href="chat.html?id=${bot.id}" target="_blank" class="btn btn-small" style="margin-top: 15px;">Try Bot</a>
            ${filterType === 'my' ? `<a href="editor.html?id=${bot.id}" class="btn btn-small btn-secondary" style="margin-top: 5px;">Edit</a>` : ''}
        `;
        botsListContainer.appendChild(botCard);
    });
}

function loadPublicAndMyBots() {
    const initialFilter = currentUser ? 'my' : 'all';
    window.filterBots(initialFilter);
}

// --- Utility Functions ---
export function showMessage(message, type = 'info', duration = 5000) {
    const mainContent = document.querySelector('.main-content') ||
                        document.querySelector('.auth-section') ||
                        document.querySelector('.editor-main') ||
                        document.querySelector('.explore-bots-main') ||
                        document.querySelector('body');

    if (!mainContent) return;

    if (type === 'clear') {
        document.querySelectorAll('.app-message').forEach(msg => msg.remove());
        return;
    }

    // Remove existing messages of the same type to prevent clutter, unless it's a persistent error
    if (type !== 'error') { // Allow multiple error messages to persist briefly if needed
        document.querySelectorAll(`.app-message.${type}-message`).forEach(msg => msg.remove());
    }


    const messageDiv = document.createElement('div');
    messageDiv.className = `app-message ${type}-message`;
    messageDiv.textContent = message;

    let prependTarget = mainContent;
    // Attempt to insert message at the top of the relevant content area
    if (mainContent.querySelector('.dashboard-content')) {
        prependTarget = mainContent.querySelector('.dashboard-content');
    } else if (mainContent.querySelector('.editor-content')) {
        prependTarget = mainContent.querySelector('.editor-content');
    } else if (mainContent.querySelector('.hero-section')) { // For home page
        prependTarget = mainContent.querySelector('.hero-section');
    }


    if (prependTarget.firstChild) {
        prependTarget.insertBefore(messageDiv, prependTarget.firstChild);
    } else {
        prependTarget.appendChild(messageDiv);
    }


    setTimeout(() => {
        messageDiv.remove();
    }, duration);
}

export function trackChatbotUsage(chatbotId, action) {
    const usage = {
        chatbotId: chatbotId,
        action: action,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        userId: currentUser ? currentUser.uid : 'anonymous'
    };

    if (db_instance) {
        const transaction = db_instance.transaction(['conversations'], 'readwrite');
        const store = transaction.objectStore('conversations');
        store.add({ id: Date.now() + Math.random(), ...usage })
            .onsuccess = () => console.log('Usage tracked:', usage);
        transaction.onerror = (event) => console.error('Error tracking usage:', event.target.error);
    } else {
        console.warn('IndexedDB not ready. Usage not tracked.');
    }
}

// Subdomain preview update for editor.html (needs to be available globally to editor.js)
window.updateSubdomainPreview = function() {
    const subdomainInput = document.getElementById('subdomain');
    if (subdomainInput) {
        const subdomain = subdomainInput.value || 'my-chatbot';
        document.getElementById('subdomain-preview').textContent = `${subdomain.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}.aichatbot.com`;
    }
};