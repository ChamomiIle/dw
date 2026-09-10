const { protect } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// دالة مساعدة لتوليد Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// 1. تسجيل حساب جديد
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تعبئة جميع الحقول المطلوب'
      });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً' 
      });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ في السيرفر أثناء إنشاء الحساب'
    });
  }
});

// 2. تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'بيانات الدخول غير صحيحة' 
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ في السيرفر أثناء تسجيل الدخول'
    });
  }
});

module.exports = router;
// مسار جلب بيانات البروفايل والتذاكر الخاصة بالمستخدم
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const tickets = await Ticket.find({ buyer: req.user._id });

    const totalTickets = tickets.length;
    const completedTickets = tickets.filter(t => t.status === 'completed').length;
    const totalAmount = tickets.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.status(200).json({
      success: true,
      user: {
        username: user.username,
        email: user.email
      },
      stats: {
        totalTickets,
        completedTickets,
        totalAmount
      },
      tickets: tickets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات البروفايل' });
  }
});