const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// ⚙️ تحقق من الأدمن
const isAdminCheck = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'غير مصرح - الأدمن فقط' });
};

// ============================================
// 💰 1. عرض رصيدي
// ============================================
router.get('/my-balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balance points username');
    res.json({
      success: true,
      balance: user.balance || 0,
      points: user.points || 0,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 📜 2. سجل حركاتي
// ============================================
router.get('/my-transactions', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('admin', 'username');

    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 👑 3. شحن رصيد (للأدمن)
// ============================================
router.post('/charge', protect, isAdminCheck, async (req, res) => {
  try {
    const { userId, amount, points, reason, signature } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ غير صحيح' });
    }
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'السبب مطلوب (3 أحرف على الأقل)' });
    }
    if (!signature || signature.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'التوقيع مطلوب' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const balanceBefore = user.balance || 0;
    const pointsBefore = user.points || 0;

    user.balance = balanceBefore + Number(amount);
    if (points && Number(points) > 0) {
      user.points = pointsBefore + Number(points);
    }
    await user.save();

    const transaction = await Transaction.create({
      user: user._id,
      admin: req.user._id,
      type: 'charge',
      amount: Number(amount),
      points: Number(points) || 0,
      reason: reason.trim(),
      signature: signature.trim(),
      balanceBefore,
      balanceAfter: user.balance,
      pointsBefore,
      pointsAfter: user.points
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user._id}`).emit('balance_updated', {
        balance: user.balance,
        points: user.points,
        message: `💰 تم شحن رصيدك بمبلغ $${amount}`
      });
    }

    console.log(`💰 شحن: ${user.username} +$${amount} (${reason})`);

    res.json({
      success: true,
      message: `تم شحن $${amount} لـ ${user.username}`,
      balance: user.balance,
      points: user.points,
      transaction
    });

  } catch (err) {
    console.error('خطأ في شحن الرصيد:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 👑 4. خصم رصيد (للأدمن)
// ============================================
router.post('/deduct', protect, isAdminCheck, async (req, res) => {
  try {
    const { userId, amount, points, reason, signature } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ غير صحيح' });
    }
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'السبب مطلوب' });
    }
    if (!signature || signature.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'التوقيع مطلوب' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const balanceBefore = user.balance || 0;
    const pointsBefore = user.points || 0;

    if (balanceBefore < Number(amount)) {
      return res.status(400).json({
        success: false,
        message: `رصيد المستخدم غير كافٍ. المتوفر: $${balanceBefore}`
      });
    }

    user.balance = balanceBefore - Number(amount);
    if (points && Number(points) > 0) {
      user.points = Math.max(0, pointsBefore - Number(points));
    }
    await user.save();

    const transaction = await Transaction.create({
      user: user._id,
      admin: req.user._id,
      type: 'deduct',
      amount: Number(amount),
      points: Number(points) || 0,
      reason: reason.trim(),
      signature: signature.trim(),
      balanceBefore,
      balanceAfter: user.balance,
      pointsBefore,
      pointsAfter: user.points
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user._id}`).emit('balance_updated', {
        balance: user.balance,
        points: user.points,
        message: `💸 تم خصم $${amount} من رصيدك`
      });
    }

    console.log(`💸 خصم: ${user.username} -$${amount} (${reason})`);

    res.json({
      success: true,
      message: `تم خصم $${amount} من ${user.username}`,
      balance: user.balance,
      points: user.points,
      transaction
    });

  } catch (err) {
    console.error('خطأ في خصم الرصيد:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 👑 5. عرض كل المستخدمين (للأدمن)
// ============================================
router.get('/users', protect, isAdminCheck, async (req, res) => {
  try {
    const users = await User.find()
      .select('username email balance points role createdAt')
      .sort({ balance: -1 });

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 👑 6. كل الحركات (للأدمن)
// ============================================
router.get('/all-transactions', protect, isAdminCheck, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'username email')
      .populate('admin', 'username');

    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// 👑 7. حركات مستخدم معين (للأدمن)
// ============================================
router.get('/user/:userId/transactions', protect, isAdminCheck, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('admin', 'username');

    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;