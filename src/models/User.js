const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'يرجى إدخال اسم المستخدم'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'يرجى إدخال البريد الإلكتروني'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'يرجى إدخال كلمة المرور'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'agent'],
      default: 'user',
    },
  },
  { timestamps: true }
);

// تشفير كلمة المرور قبل الحفظ (بدون استخدام next لمنع الخطأ)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// دالة التحقق من كلمة المرور
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);