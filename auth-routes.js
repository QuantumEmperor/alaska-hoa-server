const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Registration = require("./registration-model");
const { requireLogin, requireAdmin } = require("./auth-middleware");
const { notifyAdmin } = require("./mailer");

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
      "Name: " + doc.name + "\nEmail: " + doc.email + "\nCondo: " + doc.condo + "\nUnit: " + doc.unit + "\nRole: " + doc.role
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

// Admin only: list every registration, in full. This is the one
// place all the sign-up data can be seen, and only your account
// (ADMIN_EMAIL in the server's settings) can reach it.
router.get("/admin/registrations", requireLogin, requireAdmin, async (req, res) => {
  const all = await Registration.find().sort({ createdAt: -1 }).select("-passwordHash");
  res.json(all);
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
