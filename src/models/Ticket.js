const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'عنوان التذكرة مطلوب'] 
  },
  description: { 
    type: String,
    default: 'لا توجد تفاصيل إضافية'
  },
  amount: { 
    type: Number, 
    required: [true, 'مبلغ الوساطة مطلوب'] 
  },
  // هنا التعديل الأهم: ربط المشتري (buyer) بجدول المستخدمين (User)
  buyer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  seller: { 
    type: String, 
    default: 'عام' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'canceled'],
    default: 'pending' 
  },
  // مصفوفة لتخزين رسائل الشات الخاصة بالتذكرة
  messages: [
  {
    sender: { type: String },
    message: { type: String },
    image: { type: String, default: null },     // 📸 الصورة Base64
    hasImage: { type: Boolean, default: false }, // 📸 هل فيها صورة؟
    socketId: { type: String },
    timestamp: { type: Date, default: Date.now }
  }
]
}, { 
  timestamps: true // يقوم بإضافة createdAt و updatedAt تلقائياً
});

module.exports = mongoose.model('Ticket', ticketSchema);
