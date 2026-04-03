const nodemailer = require('nodemailer');

async function testEmail() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log("Test Account:", testAccount);
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"Test Sender" <test@example.com>',
      to: 'samiabutouq116@gmail.com',
      subject: 'Test Email',
      text: 'This is a test.',
    });

    console.log("Message sent:", info.messageId);
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.error("Email Error:", e);
  }
}

testEmail();
