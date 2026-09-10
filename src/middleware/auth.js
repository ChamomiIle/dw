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