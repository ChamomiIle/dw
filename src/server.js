const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// استيراد مسارات الـ Routes بالأسماء الصحيحة المطابقة لمجلد routes لديك
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const app = express();
const server = http.createServer(app);

// إعدادات الـ CORS والسيرفر الحقيقي
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// تقديم الملفات الثابتة (HTML, CSS, JS) من مجلد src/public
app.use(express.static(path.join(__dirname, 'public')));

// ربط المسارات (Routes) بالبادئات الأساسية
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

// ربط نظام الشات الحقيقي باستخدام Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 تم اتصال عميل جديد بالـ Socket: ${socket.id}`);

  socket.on('join_ticket', (ticketId) => {
    socket.join(ticketId);
    console.log(`👤 انضم المستخدم الغرفة/التذكرة: ${ticketId}`);
  });

  socket.on('send_message', async (data) => {
    const { ticketId, sender, message } = data;
    
    // حفظ الرسالة في قاعدة البيانات
    try {
      const Ticket = require('./models/Ticket');
      await Ticket.findByIdAndUpdate(ticketId, {
        $push: { messages: { sender, message, socketId: socket.id, timestamp: new Date() } }
      });
    } catch (err) {
      console.error('خطأ في حفظ الرسالة:', err.message);
    }

    // بث الرسالة لكل المتواجدين في نفس الغرفة
    io.to(ticketId).emit('receive_message', {
      sender,
      message,
      socketId: socket.id,
      timestamp: new Date()
    });
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
      console.log(`🚀 السيرفر شغال يمعلم على البورت ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
  });