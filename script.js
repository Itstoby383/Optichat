// App State
let currentUser = null;
let isLoggedIn = false;
let currentPage = 'login';
let posts = [];
let friends = [];
let notifications = [];
let conversations = [];
let currentChat = null;

// Mock Data
const mockPosts = [
    {
        id: 1,
        user: { name: "Alice Johnson", avatar: "https://i.pravatar.cc/150?img=1" },
        content: "Just finished my morning run! Feeling amazing! 🏃‍♀️",
        image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
        likes: 245,
        comments: 42,
        shares: 12,
        time: "2 hours ago"
    },
    {
        id: 2,
        user: { name: "Bob Smith", avatar: "https://i.pravatar.cc/150?img=2" },
        content: "The new React features are incredible! Can't wait to try them out.",
        likes: 189,
        comments: 56,
        shares: 8,
        time: "4 hours ago"
    }
];

const mockFriends = [
    { id: 1, name: "Alice Johnson", avatar: "https://i.pravatar.cc/150?img=1", mutual: 24 },
    { id: 2, name: "Bob Smith", avatar: "https://i.pravatar.cc/150?img=2", mutual: 18 },
    { id: 3, name: "Charlie Brown", avatar: "https://i.pravatar.cc/150?img=3", mutual: 32 },
    { id: 4, name: "Diana Prince", avatar: "https://i.pravatar.cc/150?img=4", mutual: 15 }
];

const mockNotifications = [
    { id: 1, type: 'like', user: 'Alice', message: 'liked your post', time: '5m', read: false },
    { id: 2, type: 'comment', user: 'Bob', message: 'commented on your photo', time: '1h', read: false },
    { id: 3, type: 'friend', user: 'Charlie', message: 'sent you a friend request', time: '2h', read: true }
];

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('facebookUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        showPage('home');
        loadFeed();
        loadFriends();
        loadNotifications();
    } else {
        showAuth('login');
    }
});

// Auth Functions
function showAuth(type) {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById(type + 'Page').classList.add('active');
}

function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    // Mock login - in real app, call your backend
    currentUser = {
        id: 1,
        name: "John Doe",
        email: email,
        avatar: "https://i.pravatar.cc/150"
    };
    
    localStorage.setItem('facebookUser', JSON.stringify(currentUser));
    isLoggedIn = true;
    
    // Hide auth pages, show main app
    document.querySelectorAll('.auth-container').forEach(el => el.style.display = 'none');
    showPage('home');
    loadFeed();
    loadFriends();
    loadNotifications();
    
    // Update user avatar
    document.querySelector('.user-avatar').src = currentUser.avatar;
}

function register() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const birthday = document.getElementById('regBirthday').value;
    
    if (!name || !email || !password || !birthday) {
        alert('Please fill all fields');
        return;
    }
    
    // Mock registration
    alert('Registration successful! Please login.');
    showAuth('login');
}

function logout() {
    localStorage.removeItem('facebookUser');
    currentUser = null;
    isLoggedIn = false;
    showAuth('login');
    document.getElementById('userMenu').style.display = 'none';
}

// Page Navigation
function showPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    
    // Show requested page
    const pageElement = document.getElementById(page + 'Page');
    if (pageElement) {
        pageElement.style.display = 'block';
        pageElement.classList.add('active');
    }
    
    currentPage = page;
    
    // Load page data
    switch(page) {
        case 'home':
            loadFeed();
            break;
        case 'friends':
            loadFriends();
            break;
        case 'messenger':
            loadMessenger();
            break;
        case 'notifications':
            loadNotifications();
            break;
    }
}

// Feed Functions
function loadFeed() {
    posts = [...mockPosts];
    renderPosts();
    
    // Simulate real-time updates
    setInterval(() => {
        if (Math.random() > 0.7 && posts.length < 10) {
            addNewPost();
        }
    }, 10000);
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = posts.map(post => `
        <div class="post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.user.avatar}" alt="${post.user.name}">
                <div class="post-info">
                    <h4>${post.user.name}</h4>
                    <span>${post.time}</span>
                </div>
            </div>
            <div class="post-content">
                ${post.content}
            </div>
            ${post.image ? `<img src="${post.image}" class="post-image" alt="Post image">` : ''}
            <div class="post-stats">
                <span>${post.likes} likes • ${post.comments} comments • ${post.shares} shares</span>
            </div>
            <div class="post-actions-footer">
                <button class="action-btn" onclick="likePost(${post.id})">
                    <i class="fas fa-thumbs-up"></i> Like
                </button>
                <button class="action-btn" onclick="commentOnPost(${post.id})">
                    <i class="fas fa-comment"></i> Comment
                </button>
                <button class="action-btn" onclick="sharePost(${post.id})">
                    <i class="fas fa-share"></i> Share
                </button>
            </div>
        </div>
    `).join('');
}

function createPost() {
    const content = document.getElementById('postContent').value;
    if (!content.trim()) return;
    
    const newPost = {
        id: posts.length + 1,
        user: currentUser,
        content: content,
        likes: 0,
        comments: 0,
        shares: 0,
        time: 'Just now'
    };
    
    posts.unshift(newPost);
    renderPosts();
    document.getElementById('postContent').value = '';
    
    // Simulate notifications to friends
    mockNotifications.unshift({
        id: mockNotifications.length + 1,
        type: 'post',
        user: currentUser.name,
        message: 'created a new post',
        time: 'now',
        read: false
    });
    updateNotificationCount();
}

function likePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.likes++;
        renderPosts();
        
        // Add notification
        if (post.user.id !== currentUser.id) {
            mockNotifications.unshift({
                id: mockNotifications.length + 1,
                type: 'like',
                user: currentUser.name,
                message: 'liked your post',
                time: 'now',
                read: false
            });
            updateNotificationCount();
        }
    }
}

function addNewPost() {
    const users = [
        { name: "Emma Watson", avatar: "https://i.pravatar.cc/150?img=5" },
        { name: "David Lee", avatar: "https://i.pravatar.cc/150?img=6" }
    ];
    
    const content = [
        "Beautiful day at the beach! 🌊",
        "Just learned a new JavaScript trick!",
        "Check out this amazing photo I took!",
        "Who's watching the game tonight? 🏈"
    ];
    
    const newPost = {
        id: posts.length + 1,
        user: users[Math.floor(Math.random() * users.length)],
        content: content[Math.floor(Math.random() * content.length)],
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 30),
        shares: Math.floor(Math.random() * 10),
        time: `${Math.floor(Math.random() * 60)} minutes ago`
    };
    
    posts.unshift(newPost);
    renderPosts();
    
    // Scroll to top to show new post
    document.getElementById('postsContainer').scrollTop = 0;
}

// Friends Functions
function loadFriends() {
    friends = [...mockFriends];
    renderFriends();
}

function renderFriends() {
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    container.innerHTML = friends.map(friend => `
        <div class="friend-card">
            <img src="${friend.avatar}" alt="${friend.name}">
            <h4>${friend.name}</h4>
            <p>${friend.mutual} mutual friends</p>
            <button class="btn-primary" onclick="messageFriend(${friend.id})">Message</button>
            <button class="btn-text" onclick="removeFriend(${friend.id})">Remove</button>
        </div>
    `).join('');
}

function addFriend(userId) {
    // In real app, send friend request to backend
    alert('Friend request sent!');
}

function removeFriend(friendId) {
    friends = friends.filter(f => f.id !== friendId);
    renderFriends();
}

// Messenger Functions
function loadMessenger() {
    // Load chat messages
    const messages = [
        { id: 1, sender: 'them', text: 'Hey there! How are you?', time: '10:30' },
        { id: 2, sender: 'me', text: 'I\'m good! Working on this Facebook clone.', time: '10:31' },
        { id: 3, sender: 'them', text: 'That sounds awesome! Can I test it?', time: '10:32' }
    ];
    
    renderMessages(messages);
    
    // Simulate receiving messages
    setInterval(() => {
        if (Math.random() > 0.8 && currentPage === 'messenger') {
            receiveMessage();
        }
    }, 15000);
}

function renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.sender === 'me' ? 'sent' : 'received'}">
            <div class="message-bubble">${msg.text}</div>
            <div class="message-time">${msg.time}</div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    const newMessage = {
        id: Date.now(),
        sender: 'me',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const messages = Array.from(document.querySelectorAll('.message')).map(msg => ({
        sender: msg.classList.contains('sent') ? 'me' : 'them',
        text: msg.querySelector('.message-bubble').textContent,
        time: msg.querySelector('.message-time')?.textContent || 'now'
    }));
    
    messages.push(newMessage);
    renderMessages(messages);
    input.value = '';
    
    // Simulate reply
    setTimeout(() => {
        const replies = [
            "That's interesting!",
            "Tell me more about that",
            "I see what you mean",
            "Sounds good to me!"
        ];
        
        const reply = {
            id: Date.now(),
            sender: 'them',
            text: replies[Math.floor(Math.random() * replies.length)],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        messages.push(reply);
        renderMessages(messages);
        
        // Update notification count
        document.getElementById('messageCount').textContent = 
            parseInt(document.getElementById('messageCount').textContent) + 1;
    }, 1000);
}

function receiveMessage() {
    const messages = Array.from(document.querySelectorAll('.message')).map(msg => ({
        sender: msg.classList.contains('sent') ? 'me' : 'them',
        text: msg.querySelector('.message-bubble').textContent,
        time: msg.querySelector('.message-time')?.textContent || 'now'
    }));
    
    const newMessage = {
        id: Date.now(),
        sender: 'them',
        text: "Hey, are you there?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    messages.push(newMessage);
    renderMessages(messages);
    
    // Update notification badge
    if (currentPage !== 'messenger') {
        const count = parseInt(document.getElementById('messageCount').textContent);
        document.getElementById('messageCount').textContent = count + 1;
    }
}

// Notifications Functions
function loadNotifications() {
    notifications = [...mockNotifications];
    renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification ${notif.read ? '' : 'unread'}">
            <div class="notification-icon">
                <i class="fas fa-${getNotificationIcon(notif.type)}"></i>
            </div>
            <div class="notification-content">
                <strong>${notif.user}</strong> ${notif.message}
                <div class="notification-time">${notif.time}</div>
            </div>
        </div>
    `).join('');
    
    updateNotificationCount();
}

function getNotificationIcon(type) {
    const icons = {
        like: 'thumbs-up',
        comment: 'comment',
        friend: 'user-plus',
        post: 'newspaper'
    };
    return icons[type] || 'bell';
}

function updateNotificationCount() {
    const unread = notifications.filter(n => !n.read).length;
    document.getElementById('notificationCount').textContent = unread;
}

// UI Functions
function toggleMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function uploadPhoto() {
    document.getElementById('mediaUpload').click();
}

function uploadVideo() {
    document.getElementById('mediaUpload').accept = 'video/*';
    document.getElementById('mediaUpload').click();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('userMenu');
    const userMenu = document.querySelector('.user-menu');
    
    if (!userMenu.contains(event.target)) {
        menu.style.display = 'none';
    }
});

// Simulate infinite scroll
window.addEventListener('scroll', function() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
        if (currentPage === 'home' && posts.length < 10) {
            // Load more posts
            setTimeout(() => {
                const morePosts = [
                    {
                        id: posts.length + 1,
                        user: { name: "Emma Wilson", avatar: "https://i.pravatar.cc/150?img=7" },
                        content: "Another great day! Thanks everyone for the birthday wishes! 🎂",
                        likes: 156,
                        comments: 23,
                        shares: 5,
                        time: "6 hours ago"
                    }
                ];
                posts.push(...morePosts);
                renderPosts();
            }, 1000);
        }
    }
});

// Initialize
function messageFriend(friendId) {
    showPage('messenger');
}

function commentOnPost(postId) {
    const comment = prompt('Enter your comment:');
    if (comment) {
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.comments++;
            renderPosts();
        }
    }
}

function sharePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.shares++;
        renderPosts();
        alert('Post shared!');
    }
}
