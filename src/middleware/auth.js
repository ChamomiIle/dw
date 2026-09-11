const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      
      req.user = await User.findById(decoded.id).select('-password');

      // ✅ تحقق من وجود المستخدم
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'الحساب غير موجود' });
      }

      // 🚫 تحقق من الحظر
      if (req.user.isBanned) {
        return res.status(403).json({
          success: false,
          message: req.user.banReason
            ? `تم حظر حسابك: ${req.user.banReason}`
            : 'تم حظر حسابك من المنصة'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'غير مصرح لك، التوكن غير صالح' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك، لم يتم إرسال توكن' });
  }
};

module.exports = { protect };
