const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Database (simple JSON files)
const DB = {
  users: loadDB('users'),
  posts: loadDB('posts'),
  friends: loadDB('friends'),
  messages: loadDB('messages'),
  notifications: loadDB('notifications')
};

function loadDB(name) {
  try {
    const data = fs.readFileSync(`backend/${name}.json`, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveDB(name, data) {
  fs.writeFileSync(`backend/${name}.json`, JSON.stringify(data, null, 2));
}

// JWT Secret
const JWT_SECRET = 'facebook-clone-secret-key-2024';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================
// Register
app.post('/api/register', upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password, birthday } = req.body;
    
    // Check if user exists
    const existingUser = DB.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      birthday,
      avatar: req.file ? `/uploads/${req.file.filename}` : `https://i.pravatar.cc/150?u=${email}`,
      bio: '',
      joined: new Date().toISOString(),
      friends: []
    };
    
    DB.users.push(user);
    saveDB('users', DB.users);
    
    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = DB.users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    
    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio
  });
});

// ==================== POSTS ROUTES ====================
// Create post
app.post('/api/posts', authenticateToken, upload.array('media', 5), (req, res) => {
  try {
    const { content } = req.body;
    const user = DB.users.find(u => u.id === req.user.id);
    
    const post = {
      id: uuidv4(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      content,
      media: req.files ? req.files.map(f => `/uploads/${f.filename}`) : [],
      likes: [],
      comments: [],
      shares: 0,
      createdAt: new Date().toISOString()
    };
    
    DB.posts.unshift(post);
    saveDB('posts', DB.posts);
    
    // Create notifications for friends
    const userFriends = DB.friends.filter(f => 
      (f.userId === user.id && f.status === 'accepted') || 
      (f.friendId === user.id && f.status === 'accepted')
    );
    
    userFriends.forEach(friend => {
      const friendId = friend.userId === user.id ? friend.friendId : friend.userId;
      const notification = {
        id: uuidv4(),
        userId: friendId,
        type: 'post',
        fromUserId: user.id,
        fromUserName: user.name,
        message: `${user.name} created a new post`,
        postId: post.id,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      DB.notifications.push(notification);
    });
    
    saveDB('notifications', DB.notifications);
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get posts
app.get('/api/posts', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  // Get user's friends
  const userFriends = DB.friends.filter(f => 
    (f.userId === userId && f.status === 'accepted') || 
    (f.friendId === userId && f.status === 'accepted')
  ).map(f => f.userId === userId ? f.friendId : f.userId);
  
  // Get posts from user and friends
  const feedPosts = DB.posts.filter(p => 
    p.userId === userId || userFriends.includes(p.userId)
  );
  
  res.json(feedPosts);
});

// Like post
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const userIndex = post.likes.indexOf(req.user.id);
  
  if (userIndex === -1) {
    post.likes.push(req.user.id);
    
    // Create notification
    if (post.userId !== req.user.id) {
      const notification = {
        id: uuidv4(),
        userId: post.userId,
        type: 'like',
        fromUserId: req.user.id,
        fromUserName: DB.users.find(u => u.id === req.user.id).name,
        message: 'liked your post',
        postId: post.id,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      DB.notifications.push(notification);
      saveDB('notifications', DB.notifications);
    }
  } else {
    post.likes.splice(userIndex, 1);
  }
  
  saveDB('posts', DB.posts);
  res.json({ likes: post.likes });
});

// Comment on post
app.post('/api/posts/:id/comment', authenticateToken, (req, res) => {
  const { text } = req.body;
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const user = DB.users.find(u => u.id === req.user.id);
  
  const comment = {
    id: uuidv4(),
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    text,
    createdAt: new Date().toISOString()
  };
  
  post.comments.push(comment);
  saveDB('posts', DB.posts);
  
  // Create notification
  if (post.userId !== req.user.id) {
    const notification = {
      id: uuidv4(),
      userId: post.userId,
      type: 'comment',
      fromUserId: user.id,
      fromUserName: user.name,
      message: 'commented on your post',
      postId: post.id,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    DB.notifications.push(notification);
    saveDB('notifications', DB.notifications);
  }
  
  res.json(comment);
});

// ==================== FRIENDS ROUTES ====================
// Find users
app.get('/api/users/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;
  
  const users = DB.users
    .filter(u => 
      u.id !== userId && 
      (u.name.toLowerCase().includes(q.toLowerCase()) || 
       u.email.toLowerCase().includes(q.toLowerCase()))
    )
    .map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      bio: u.bio
    }));
  
  res.json(users);
});

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  const { friendId } = req.body;
  const userId = req.user.id;
  
  // Check if already friends
  const existing = DB.friends.find(f => 
    (f.userId === userId && f.friendId === friendId) || 
    (f.userId === friendId && f.friendId === userId)
  );
  
  if (existing) {
    return res.status(400).json({ error: 'Friend request already exists' });
  }
  
  const friendRequest = {
    id: uuidv4(),
    userId,
    friendId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  DB.friends.push(friendRequest);
  saveDB('friends', DB.friends);
  
  // Create notification
  const notification = {
    id: uuidv4(),
    userId: friendId,
    type: 'friend_request',
    fromUserId: userId,
    fromUserName: DB.users.find(u => u.id === userId).name,
    message: 'sent you a friend request',
    read: false,
    createdAt: new Date().toISOString()
  };
  
  DB.notifications.push(notification);
  saveDB('notifications', DB.notifications);
  
  res.json(friendRequest);
});

// Get friend requests
app.get('/api/friends/requests', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  const requests = DB.friends
    .filter(f => f.friendId === userId && f.status === 'pending')
    .map(request => ({
      ...request,
      user: DB.users.find(u => u.id === request.userId)
    }));
  
  res.json(requests);
});

// Accept/reject friend request
app.post('/api/friends/:id/respond', authenticateToken, (req, res) => {
  const { action } = req.body; // 'accept' or 'reject'
  const request = DB.friends.find(f => f.id === req.params.id);
  
  if (!request || request.friendId !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  if (action === 'accept') {
    request.status = 'accepted';
    
    // Add to user's friends list
    const user = DB.users.find(u => u.id === req.user.id);
    const friend = DB.users.find(u => u.id === request.userId);
    
    if (user && friend) {
      user.friends = user.friends || [];
      friend.friends = friend.friends || [];
      
      if (!user.friends.includes(friend.id)) user.friends.push(friend.id);
      if (!friend.friends.includes(user.id)) friend.friends.push(user.id);
      
      saveDB('users', DB.users);
    }
    
    // Create notification
    const notification = {
      id: uuidv4(),
      userId: request.userId,
      type: 'friend_accept',
      fromUserId: req.user.id,
      fromUserName: DB.users.find(u => u.id === req.user.id).name,
      message: 'accepted your friend request',
      read: false,
      createdAt: new Date().toISOString()
    };
    
    DB.notifications.push(notification);
  } else {
    request.status = 'rejected';
  }
  
  saveDB('friends', DB.friends);
  saveDB('notifications', DB.notifications);
  
  res.json(request);
});

// Get friends
app.get('/api/friends', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  const friends = DB.friends
    .filter(f => 
      (f.userId === userId || f.friendId === userId) && 
      f.status === 'accepted'
    )
    .map(f => {
      const friendId = f.userId === userId ? f.friendId : f.userId;
      return DB.users.find(u => u.id === friendId);
    })
    .filter(Boolean);
  
  res.json(friends);
});

// ==================== MESSAGES ROUTES ====================
// Get conversations
app.get('/api/messages/conversations', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  const conversations = DB.messages
    .filter(m => m.senderId === userId || m.receiverId === userId)
    .reduce((acc, message) => {
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      const otherUser = DB.users.find(u => u.id === otherUserId);
      
      if (!acc[otherUserId]) {
        acc[otherUserId] = {
          user: {
            id: otherUser.id,
            name: otherUser.name,
            avatar: otherUser.avatar
          },
          lastMessage: message,
          unreadCount: message.receiverId === userId && !message.read ? 1 : 0
        };
      } else {
        if (message.createdAt > acc[otherUserId].lastMessage.createdAt) {
          acc[otherUserId].lastMessage = message;
        }
        if (message.receiverId === userId && !message.read) {
          acc[otherUserId].unreadCount++;
        }
      }
      
      return acc;
    }, {});
  
  res.json(Object.values(conversations));
});

// Get messages with a user
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const otherUserId = req.params.userId;
  
  const messages = DB.messages
    .filter(m => 
      (m.senderId === userId && m.receiverId === otherUserId) ||
      (m.senderId === otherUserId && m.receiverId === userId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  // Mark as read
  messages.forEach(m => {
    if (m.receiverId === userId && !m.read) {
      m.read = true;
    }
  });
  
  saveDB('messages', DB.messages);
  
  res.json(messages);
});

// Send message
app.post('/api/messages', authenticateToken, (req, res) => {
  const { receiverId, text } = req.body;
  
  const message = {
    id: uuidv4(),
    senderId: req.user.id,
    receiverId,
    text,
    read: false,
    createdAt: new Date().toISOString()
  };
  
  DB.messages.push(message);
  saveDB('messages', DB.messages);
  
  // Socket.io emit new message
  io.emit('new_message', message);
  
  res.json(message);
});

// ==================== NOTIFICATIONS ROUTES ====================
app.get('/api/notifications', authenticateToken, (req, res) => {
  const notifications = DB.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(notifications);
});

app.post('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notification = DB.notifications.find(n => n.id === req.params.id);
  
  if (notification && notification.userId === req.user.id) {
    notification.read = true;
    saveDB('notifications', DB.notifications);
  }
  
  res.json({ success: true });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join', (userId) => {
    socket.join(userId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}`);
});