const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Registration = require("./registration-model");
const { requireLogin, requireAdmin } = require("./auth-middleware");
const { notifyAdmin, sendMail } = require("./mailer");

const router = express.Router();

function sign(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

// Sign up: matches the fields on the registration screen in the app.
router.post("/register", async (req, res) => {
  try {
    const {
      name, email, password, unit, role,
      condo, units, dues, covers, mgr, mgrName, reserve, lawsuit, quorum,
      newsletter, agreedToPrivacyPolicy,
    } = req.body;

    if (!name || !email || !password || !unit || !condo) {
      return res.status(400).json({ error: "Please fill in your name, email, password, unit, and condo name." });
    }
    if (!agreedToPrivacyPolicy) {
      return res.status(400).json({ error: "Please agree to the Privacy Policy to continue." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const existing = await Registration.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "That email is already registered. Try signing in instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await Registration.create({
      name, email: String(email).toLowerCase(), passwordHash, unit, role,
      condo, units, dues, covers, mgr, mgrName, reserve, lawsuit, quorum,
      newsletter: !!newsletter, agreedToPrivacyPolicy: true,
    });

    notifyAdmin(
      "New HOA Next Door sign-up: " + doc.name,
      "Name: " + doc.name +
        "\nEmail: " + doc.email +
        "\nUnit: " + doc.unit +
        "\nRole: " + doc.role +
        "\nCondo/HOA: " + doc.condo +
        "\nUnits: " + doc.units +
        "\nMonthly dues: $" + doc.dues +
        "\nDues cover: " + ((doc.covers && doc.covers.length) ? doc.covers.join(", ") : "—") +
        "\nManaged by: " + doc.mgr + (doc.mgrName ? " — " + doc.mgrName : "") +
        "\nReserve fund: " + doc.reserve +
        "\nIn a lawsuit: " + doc.lawsuit +
        "\nQuorum: " + doc.quorum +
        "\nWants newsletter: " + (doc.newsletter ? "Yes" : "No")
    );

    const token = sign(doc);
    res.status(201).json({
      token,
      user: { name: doc.name, email: doc.email, unit: doc.unit, condo: doc.condo, units: doc.units, dues: doc.dues },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while signing you up." });
  }
});

// Sign in: email + password, returns a login token the app remembers.
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Enter your email and password." });
    }
    const doc = await Registration.findOne({ email: String(email).toLowerCase() });
    if (!doc) {
      return res.status(401).json({ error: "No account found with that email." });
    }
    const ok = await bcrypt.compare(password, doc.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "That password doesn't match." });
    }
    const token = sign(doc);
    res.json({
      token,
      user: { name: doc.name, email: doc.email, unit: doc.unit, condo: doc.condo, units: doc.units, dues: doc.dues },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while signing you in." });
  }
});

// Forgot password: emails a one-time reset link if that email is registered.
// Always responds the same way either way, so this can't be used to check
// which emails have accounts.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Enter your email." });

    const doc = await Registration.findOne({ email: String(email).toLowerCase() });
    if (doc) {
      const token = crypto.randomBytes(32).toString("hex");
      doc.resetToken = token;
      doc.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await doc.save();

      const site = process.env.SITE_URL || "https://quantumemperor.github.io/hoa-next-door-app";
      const link = site + "/?reset=" + token;
      sendMail(
        doc.email,
        "Reset your HOA Next Door password",
        "Someone (hopefully you) asked to reset the password on your HOA Next Door account.\n\n" +
          "Click this link to set a new password. It expires in 1 hour:\n" + link +
          "\n\nIf you didn't ask for this, you can safely ignore this email."
      );
    }
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Reset password: takes the token from the emailed link plus a new password.
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Missing reset link or new password." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    const doc = await Registration.findOne({ resetToken: token, resetTokenExpires: { $gt: new Date() } });
    if (!doc) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    }
    doc.passwordHash = await bcrypt.hash(password, 10);
    doc.resetToken = null;
    doc.resetTokenExpires = null;
    await doc.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset your password. Please try again." });
  }
});

// Admin only: list every registration, in full. This is the one
// place all the sign-up data can be seen, and only your account
// (ADMIN_EMAIL in the server's settings) can reach it.
router.get("/admin/registrations", requireLogin, requireAdmin, async (req, res) => {
  const all = await Registration.find().sort({ createdAt: -1 }).select("-passwordHash");
  res.json(all);
});

// Admin only: set a new password for someone directly. Use this when a
// member is locked out and can't receive a "forgot password" email (that
// email can currently only be delivered to your own admin address, since no
// domain is verified with Resend yet). Tell the member the new password
// yourself (text, call, in person).
router.put("/admin/registrations/:id/password", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    const doc = await Registration.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "That registration no longer exists." });
    doc.passwordHash = await bcrypt.hash(password, 10);
    doc.resetToken = null;
    doc.resetTokenExpires = null;
    await doc.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update that password." });
  }
});

// Admin only: delete a registration (e.g. to free up a test email address).
router.delete("/admin/registrations/:id", requireLogin, requireAdmin, async (req, res) => {
  try {
    const doc = await Registration.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "That registration no longer exists." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete that registration." });
  }
});

module.exports = router;
