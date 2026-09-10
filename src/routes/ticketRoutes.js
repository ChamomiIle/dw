const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const { protect } = require('../middleware/auth');

// 1. إنشاء تذكرة وساطة جديدة (محمي)
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, amount, seller } = req.body;

    const newTicket = await Ticket.create({
      title,
      description,
      amount,
      buyer: req.user._id,
      seller: seller || 'عام',
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء تذكرة الوساطة بنجاح',
      ticket: newTicket,
      data: newTicket,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'فشل في إنشاء التذكرة',
      error: error.message,
    });
  }
});

// 2. جلب التذاكر (تكتات خاصة للمستخدم، أو الكل للأدمن)
router.get('/', protect, async (req, res) => {
  try {
    let query = {};

    // إذا لم يكن المستخدم مشرفاً، نجلب تذاكره الخاصة فقط بناءً على الـ ID حقّه
    if (req.user.role !== 'admin') {
      query.buyer = req.user._id;
    }

    const tickets = await Ticket.find(query)
      .populate('buyer', 'name email username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets: tickets,
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'فشل في جلب التذاكر',
      error: error.message,
    });
  }
});

// 3. تحديث حالة التذكرة (محمي)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'التذكرة غير موجودة' });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة التذكرة بنجاح',
      data: ticket,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;