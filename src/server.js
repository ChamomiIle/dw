const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// استيراد مسارات الـ Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const walletRoutes = require('./routes/walletRoutes'); // 💰 جديد

const app = express();
const server = http.createServer(app);

// إعدادات الـ CORS + Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  },
  maxHttpBufferSize: 1e7 // 📸 10 ميجا للصور
});

// ✅ مشاركة io مع الراوترات
app.set('io', io);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));

// 📸 زيادة حد JSON للصور
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// ربط المسارات (Routes)
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/wallet', walletRoutes); // 💰 جديد

// ============================================
// 🔌 ربط نظام الشات الحقيقي - Socket.io
// ============================================
io.on('connection', (socket) => {
  console.log(`🔌 تم اتصال عميل جديد بالـ Socket: ${socket.id}`);

  // 👤 غرفة خاصة لكل مستخدم (للإشعارات) — 💰 جديد
  socket.on('register_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 المستخدم ${userId} انضم لغرفته الخاصة`);
  });

  // الانضمام لغرفة تذكرة
  socket.on('join_ticket', (ticketId) => {
    socket.join(ticketId);
    console.log(`👤 انضم المستخدم الغرفة/التذكرة: ${ticketId}`);
  });

  // 📸 إرسال رسالة (نص + صورة)
  socket.on('send_message', async (data) => {
    const { ticketId, sender, message, image, hasImage } = data;
    
    console.log(`📨 رسالة جديدة في ${ticketId} من ${sender}${hasImage ? ' [مع صورة]' : ''}`);

    // حفظ الرسالة في قاعدة البيانات
    try {
      const Ticket = require('./models/Ticket');
      await Ticket.findByIdAndUpdate(ticketId, {
        $push: {
          messages: {
            sender,
            message: message || '',
            image: image || null,
            hasImage: hasImage || false,
            socketId: socket.id,
            timestamp: new Date()
          }
        }
      });
    } catch (err) {
      console.error('❌ خطأ في حفظ الرسالة:', err.message);
    }

    // بث الرسالة لكل المتواجدين في نفس الغرفة
    io.to(ticketId).emit('receive_message', {
      sender,
      message: message || '',
      image: image || null,
      hasImage: hasImage || false,
      socketId: socket.id,
      timestamp: new Date()
    });
  });

  // 🔄 تحديث حالة التذكرة
  socket.on('status_updated', (data) => {
    const { ticketId, status } = data;
    console.log(`🔄 تحديث حالة التذكرة ${ticketId} إلى: ${status}`);
    io.to(ticketId).emit('status_updated', data);
  });

  socket.on('disconnect', () => {
    console.log(`❌ انقطع اتصال عميل: ${socket.id}`);
  });
});

// الاتصال بقاعدة بيانات MongoDB
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!');
    server.listen(PORT, () => {
      console.log(`🚀 السيرفر شغال على البورت ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
  });
