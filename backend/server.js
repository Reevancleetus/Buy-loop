const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time notifications
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const userSockets = {}; // Map: userId -> socketId

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register', (userId) => {
    if (userId) {
      socket.userId = userId;
      userSockets[userId] = socket.id;
      console.log(`User ${userId} registered socket ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.userId && userSockets[socket.userId] === socket.id) {
      delete userSockets[socket.userId];
      console.log(`User ${socket.userId} unregistered socket`);
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Buy-loop hyperlocal marketplace Socket.io server is running.' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.io server listening on port ${PORT}`);
});
