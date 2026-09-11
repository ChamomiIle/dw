const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ خطأ في إعداد البريد:', error.message);
  } else {
    console.log('✅ البريد جاهز للإرسال');
  }
});

async function sendVerificationCode(email, code, username, type = 'verify') {
  const subjects = {
    verify: '🔐 تأكيد حسابك في ضماني',
    login: '🔐 كود تسجيل الدخول - ضماني'
  };
  
  const messages = {
    verify: `مرحباً ${username}، شكراً لتسجيلك في منصة ضماني! كود تفعيل حسابك هو:`,
    login: `مرحباً ${username}، كود تسجيل الدخول الخاص بك هو:`
  };

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 30px; border: 1px solid #38bdf8; }
        .logo { text-align: center; font-size: 28px; font-weight: 900; color: #38bdf8; margin-bottom: 20px; }
        .logo span { color: #fff; }
        h2 { color: #fff; text-align: center; margin-bottom: 20px; font-size: 20px; }
        .message { color: #94a3b8; text-align: center; line-height: 1.8; margin-bottom: 25px; font-size: 15px; }
        .code-box { background: #0f172a; border: 2px dashed #38bdf8; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 36px; font-weight: 900; color: #38bdf8; letter-spacing: 8px; font-family: monospace; }
        .footer { color: #64748b; text-align: center; font-size: 12px; margin-top: 30px; border-top: 1px solid #334155; padding-top: 20px; }
        .warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px; margin-top: 20px; color: #f59e0b; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">ضماني 🛡️</div>
        <h2>${subjects[type]}</h2>
        <p class="message">${messages[type]}</p>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <p class="message">⏰ الكود صالح لمدة <strong>10 دقائق</strong> فقط</p>
        <div class="warning">⚠️ إذا لم تطلب هذا الكود، تجاهل هذه الرسالة فوراً</div>
        <div class="footer">© 2026 منصة ضماني للوساطة الرقمية المضمونة</div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ضماني <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subjects[type],
      html: html
    });
    console.log(`📧 تم إرسال كود ${type} إلى: ${email}`);
    return true;
  } catch (err) {
    console.error(`❌ فشل إرسال البريد إلى ${email}:`, err.message);
    throw err;
  }
}

module.exports = { sendVerificationCode, transporter };
