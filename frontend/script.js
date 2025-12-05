// Configuration
const API_URL = 'http://localhost:3001/api';
let currentUser = null;
let token = localStorage.getItem('token');
let socket = null;

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Utility Functions
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.style.background = type === 'error' ? '#e41e3f' : '#1877f2';
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Something went wrong');
    }
    
    return response.json();
}

async function uploadFile(file, endpoint) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    
    return response.json();
}

// Auth Functions
async function checkAuth() {
    if (!token) {
        showAuth('login');
        return;
    }
    
    try {
        showLoading();
        const user = await apiRequest('/me');
        currentUser = user;
        initApp();
    } catch (error) {
        localStorage.removeItem('token');
        token = null;
        showAuth('login');
        showToast('Session expired. Please login again.', 'error');
    } finally {
        hideLoading();
    }
}

async function login(email, password) {
    try {
        showLoading();
        const data = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        token = data.token;
        currentUser = data.user;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        initApp();
        showToast('Login successful!');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function register(formData) {
    try {
        showLoading();
        
        const data = new FormData();
        data.append('name', formData.name);
        data.append('email', formData.email);
        data.append('password', formData.password);
        data.append('birthday', formData.birthday);
        
        if (formData.avatar) {
            data.append('avatar', formData.avatar);
        }
        
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            body: data
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        const result = await response.json();
        
        token = result.token;
        currentUser = result.user;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        showToast('Account created successfully!');
        
        // Start fresh - no friends, no posts
        showPage('home');
        loadFeed();
        loadFriends();
        
        hideModal('registerModal');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    showAuth('login');
    showToast('Logged out successfully');
}

// Post Functions
let currentPostPage = 1;
let hasMorePosts = true;

async function loadFeed() {
    try {
        const posts = await apiRequest('/posts');
        renderPosts(posts);
        
        // Set up infinite scroll
        window.onscroll = async () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && hasMorePosts) {
                currentPostPage++;
                const morePosts = await apiRequest(`/posts?page=${currentPostPage}`);
                if (morePosts.length === 0) {
                    hasMorePosts = false;
                } else {
                    renderPosts([...posts, ...morePosts]);
                }
            }
        };
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function createPost(content, mediaFiles = []) {
    try {
        const formData = new FormData();
        formData.append('content', content);
        
        mediaFiles.forEach(file => {
            formData.append('media', file);
        });
        
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to create post');
        
        const post = await response.json();
        addPostToFeed(post);
        showToast('Post created!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function likePost(postId) {
    try {
        const result = await apiRequest(`/posts/${postId}/like`, {
            method: 'POST'
        });
        
        updatePostLikes(postId, result.likes);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function commentOnPost(postId, text) {
    try {
        const comment = await apiRequest(`/posts/${postId}/comment`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        
        addCommentToPost(postId, comment);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Friends Functions
async function searchUsers(query) {
    try {
        const users = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
        return users;
    } catch (error) {
        showToast(error.message, 'error');
        return [];
    }
}

async function sendFriendRequest(friendId) {
    try {
        await apiRequest('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ friendId })
        });
        
        showToast('Friend request sent!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadFriends() {
    try {
        const friends = await apiRequest('/friends');
        renderFriends(friends);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadFriendRequests() {
    try {
        const requests = await apiRequest('/friends/requests');
        renderFriendRequests(requests);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function respondToFriendRequest(requestId, action) {
    try {
        await apiRequest(`/friends/${requestId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ action })
        });
        
        showToast(`Friend request ${action}ed!`);
        loadFriendRequests();
        loadFriends();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Messenger Functions
async function loadConversations() {
    try {
        const conversations = await apiRequest('/messages/conversations');
        renderConversations(conversations);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadMessages(userId) {
    try {
        const messages = await apiRequest(`/messages/${userId}`);
        renderMessages(messages);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function sendMessage(receiverId, text) {
    try {
        const message = await apiRequest('/messages', {
            method: 'POST',
            body: JSON.stringify({ receiverId, text })
        });
        
        addMessageToChat(message);
        
        // Emit via socket
        if (socket) {
            socket.emit('send_message', {
                receiverId,
                message: text
            });
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Notifications Functions
async function loadNotifications() {
    try {
        const notifications = await apiRequest('/notifications');
        renderNotifications(notifications);
        updateNotificationBadge(notifications);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await apiRequest(`/notifications/${notificationId}/read`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

// Socket.io Setup
function initSocket() {
    if (!token || !currentUser) return;
    
    socket = io('http://localhost:3001', {
        auth: {
            token: token
        }
    });
    
    socket.on('connect', () => {
        console.log('Connected to WebSocket');
        socket.emit('join', currentUser.id);
    });
    
    socket.on('new_message', (message) => {
        if (currentPage === 'messenger' && 
            (message.senderId === currentChat?.userId || message.receiverId === currentChat?.userId)) {
            addMessageToChat(message);
        }
        
        // Update notification badge
        if (message.receiverId === currentUser.id) {
            const badge = document.getElementById('messageCount');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                badge.textContent = current + 1;
            }
        }
    });
    
    socket.on('new_notification', (notification) => {
        if (notification.userId === currentUser.id) {
            addNotification(notification);
            updateNotificationBadge();
            showToast(`New notification: ${notification.message}`);
        }
    });
    
    socket.on('friend_request', (request) => {
        if (request.friendId === currentUser.id) {
            showToast(`New friend request from ${request.fromUserName}`);
            loadFriendRequests();
        }
    });
}

// UI Functions
function initApp() {
    // Show main app
    document.querySelectorAll('.auth-container').forEach(el => el.style.display = 'none');
    document.getElementById('navbar').style.display = 'flex';
    document.getElementById('container').style.display = 'flex';
    
    // Set user avatar
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar && currentUser?.avatar) {
        userAvatar.src = currentUser.avatar.startsWith('http') ? currentUser.avatar : `${API_URL}${currentUser.avatar}`;
    }
    
    // Load initial data
    showPage('home');
    loadFeed();
    loadFriends();
    loadFriendRequests();
    loadNotifications();
    loadConversations();
    
    // Initialize WebSocket
    initSocket();
}

function showAuth(type) {
    document.querySelectorAll('.auth-container').forEach(el => el.style.display = 'none');
    document.getElementById(`${type}Page`).style.display = 'block';
    
    // Hide main app
    document.getElementById('navbar').style.display = 'none';
    document.getElementById('container').style.display = 'none';
}

// Avatar Upload
let selectedAvatar = null;

function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size should be less than 5MB', 'error');
        return;
    }
    
    selectedAvatar = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('avatarPreview').src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Form Handlers
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await login(email, password);
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        birthday: document.getElementById('regBirthday').value,
        avatar: selectedAvatar
    };
    
    await register(formData);
});

// Event Listeners for dynamic content
document.addEventListener('click', (e) => {
    // Like button
    if (e.target.closest('.like-btn')) {
        const postId = e.target.closest('.post').dataset.id;
        likePost(postId);
    }
    
    // Comment button
    if (e.target.closest('.comment-btn')) {
        const postId = e.target.closest('.post').dataset.id;
        const text = prompt('Enter your comment:');
        if (text) {
            commentOnPost(postId, text);
        }
    }
    
    // Friend request buttons
    if (e.target.closest('.accept-request')) {
        const requestId = e.target.closest('.friend-request').dataset.id;
        respondToFriendRequest(requestId, 'accept');
    }
    
    if (e.target.closest('.reject-request')) {
        const requestId = e.target.closest('.friend-request').dataset.id;
        respondToFriendRequest(requestId, 'reject');
    }
    
    // Send message
    if (e.target.closest('.send-message-btn')) {
        const friendId = e.target.closest('.friend-card').dataset.id;
        showPage('messenger');
        selectChat(friendId);
    }
});

// Search functionality
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = e.target.value;
        if (query.length > 2) {
            const users = await searchUsers(query);
            showSearchResults(users);
        }
    }, 300);
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});