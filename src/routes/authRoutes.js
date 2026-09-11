const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationCode } = require('../config/mailer');

// ⚙️ توليد كود 6 أرقام
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ⚙️ توليد توكن JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '30d' }
  );
}

// ============================================
// 📝 تسجيل حساب جديد
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ message: 'هذا البريد الإلكتروني مسجل مسبقاً' });
      }
      return res.status(400).json({ message: 'اسم المستخدم مسجل مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      verificationCode: code,
      verificationCodeExpires: expires,
      verificationType: 'verify'
    });

    try {
      await sendVerificationCode(email, code, username, 'verify');
      console.log(`✅ تم إنشاء الحساب وإرسال الكود: ${email}`);
    } catch (mailErr) {
      console.error('فشل إرسال البريد:', mailErr.message);
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ message: 'فشل إرسال كود التحقق، حاول لاحقاً' });
    }

    res.status(201).json({
      message: 'تم إنشاء الحساب! تحقق من إيميلك للكود',
      email: user.email,
      requiresVerification: true,
      userId: user._id
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ============================================
// ✅ تأكيد الكود
// ============================================
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'البريد والكود مطلوبان' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+verificationCode +verificationCodeExpires +verificationType');

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'الحساب مفعل مسبقاً' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'كود التحقق غير صحيح' });
    }

    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({ message: 'انتهت صلاحية الكود، اطلب كوداً جديداً' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = generateToken(user);

    console.log(`✅ تم تفعيل الحساب: ${user.email}`);

    res.json({
      message: 'تم تفعيل حسابك بنجاح!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ============================================
// 🔄 إعادة إرسال الكود
// ============================================
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'البريد مطلوب' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'الحساب مفعل مسبقاً' });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationCode = code;
    user.verificationCodeExpires = expires;
    user.verificationType = 'verify';
    await user.save();

    await sendVerificationCode(email, code, user.username, 'verify');

    res.json({ message: 'تم إرسال كود جديد إلى إيميلك' });

  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ============================================
// 🔐 تسجيل الدخول
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'كلمة المرور مطلوبة' });
    }

    const query = email ? { email: email.toLowerCase() } : { username };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: user.banReason 
          ? `تم حظر حسابك: ${user.banReason}` 
          : 'تم حظر حسابك من المنصة'
      });
    }

    if (!user.isVerified) {
      const code = generateCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      user.verificationCode = code;
      user.verificationCodeExpires = expires;
      user.verificationType = 'verify';
      await user.save();
      
      try {
        await sendVerificationCode(user.email, code, user.username, 'verify');
      } catch (e) {
        console.error(e);
      }

      return res.status(403).json({
        message: 'حسابك غير مفعل. تحقق من إيميلك',
        requiresVerification: true,
        email: user.email
      });
    }

    const loginCode = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationCode = loginCode;
    user.verificationCodeExpires = expires;
    user.verificationType = 'login';
    await user.save();

    try {
      await sendVerificationCode(user.email, loginCode, user.username, 'login');
    } catch (mailErr) {
      return res.status(500).json({ message: 'فشل إرسال كود الدخول، حاول لاحقاً' });
    }

    console.log(`📧 كود دخول لـ ${user.email}: ${loginCode}`);

    res.json({
      message: 'تم إرسال كود تسجيل الدخول إلى إيميلك',
      email: user.email,
      requiresCode: true,
      userId: user._id
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ============================================
// 🔓 التحقق من كود الدخول
// ============================================
router.post('/verify-login', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'البريد والكود مطلوبان' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+verificationCode +verificationCodeExpires +verificationType');

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'كود التحقق غير صحيح' });
    }

    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({ message: 'انتهت صلاحية الكود' });
    }

    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    console.log(`✅ تسجيل دخول: ${user.email}`);

    res.json({
      message: 'تم تسجيل الدخول بنجاح!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Verify login error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ============================================
// 👤 الملف الشخصي
// ============================================
const { protect } = require('../middleware/auth');

router.get('/profile', protect, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    
    const tickets = await Ticket.find({
      $or: [
        { createdBy: req.user._id },
        { buyer: req.user._id }
      ]
    }).sort({ createdAt: -1 });

    const completedTickets = tickets.filter(t => t.status === 'completed');
    const totalAmount = tickets.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.json({
      user: {
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      },
      stats: {
        totalTickets: tickets.length,
        completedTickets: completedTickets.length,
        totalAmount: totalAmount
      },
      tickets: tickets.slice(0, 10)
    });

  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

module.exports = router;
