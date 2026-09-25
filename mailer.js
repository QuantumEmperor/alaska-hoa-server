// Sends you a notification email using Resend (resend.com) instead of
// Gmail's own mail servers. Render (like many cloud hosts) blocks outgoing
// SMTP connections, which is why the Gmail version kept timing out. Resend
// sends over a normal HTTPS web request instead, so it isn't blocked.
var fetchFn = typeof fetch === "function" ? fetch : require("node-fetch");

function notifyAdmin(subject, text) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) {
    console.log("Email not configured; skipping notification:", subject);
    return;
  }
  fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "HOA Next Door <onboarding@resend.dev>",
      to: [process.env.ADMIN_EMAIL],
      subject: subject,
      text: text,
    }),
  })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          console.error("Could not send notification email:", res.status, t);
        });
      }
    })
    .catch(function (err) {
      console.error("Could not send notification email:", err.message);
    });
}

module.exports = { notifyAdmin };
