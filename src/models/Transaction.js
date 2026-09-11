const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // 👤 المستخدم المعني
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // 👑 المشرف
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // 📊 نوع الحركة
  type: {
    type: String,
    enum: ['charge', 'deduct', 'transfer_in', 'transfer_out', 'refund'],
    required: true
  },
  
  // 💵 المبلغ
  amount: {
    type: Number,
    required: true
  },
  
  // 🎯 النقاط
  points: {
    type: Number,
    default: 0
  },
  
  // 📝 السبب
  reason: {
    type: String,
    required: true,
    trim: true
  },
  
  // ✍️ توقيع الأدمن
  signature: {
    type: String,
    default: ''
  },
  
  // 💰 القيم قبل/بعد
  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },
  pointsBefore: { type: Number, default: 0 },
  pointsAfter: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);