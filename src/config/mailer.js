const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
  tls: { rejectUnauthorized: false }
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ خطأ SMTP:', error.message);
  } else {
    console.log('✅ البريد جاهز');
  }
});

async function sendVerificationCode(email, code, username, type = 'verify') {
  const subjects = {
    verify: '🔐 تأكيد حسابك في ضماني',
    login: '🔐 كود تسجيل الدخول - ضماني'
  };
  const messages = {
    verify: 'شكراً لتسجيلك في منصة ضماني! كود تفعيل حسابك هو:',
    login: 'كود تسجيل الدخول الخاص بك هو:'
  };

  const html = '<div style="font-family:Arial;background:#0f172a;padding:30px;color:#fff;text-align:center;direction:rtl;">' +
    '<h1 style="color:#38bdf8;">ضماني 🛡️</h1>' +
    '<h2>' + subjects[type] + '</h2>' +
    '<p>مرحباً ' + username + '، ' + messages[type] + '</p>' +
    '<div style="background:#0f172a;border:2px dashed #38bdf8;padding:20px;font-size:36px;font-weight:900;color:#38bdf8;letter-spacing:8px;margin:20px 0;font-family:monospace;">' + code + '</div>' +
    '<p style="color:#94a3b8;font-size:13px;">الكود صالح لمدة 10 دقائق</p>' +
    '</div>';

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || ('ضماني <' + process.env.EMAIL_USER + '>'),
    to: email,
    subject: subjects[type],
    html: html
  });
  
  console.log('📧 تم إرسال كود ' + type + ' إلى: ' + email);
  return true;
}

module.exports = { sendVerificationCode, transporter };
