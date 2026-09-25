const nodemailer = require("nodemailer");

// Sends you a plain email using your own Gmail account. If EMAIL_USER /
// EMAIL_PASS aren't set, this quietly does nothing instead of crashing
// anything — notifications are a nice-to-have, not something that should
// ever break a sign-up.
function notifyAdmin(subject, text) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email not configured; skipping notification:", subject);
    return;
  }
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  transporter
    .sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: subject,
      text: text,
    })
    .catch(function (err) {
      console.error("Could not send notification email:", err.message);
    });
}

module.exports = { notifyAdmin };
