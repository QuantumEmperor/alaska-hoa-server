const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Registration = require("./registration-model");
const Post = require("./post-model");
const Reply = require("./reply-model");
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
      user: fullUser(doc),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while signing you up." });
  }
});

// Shape of "your own account" data sent back to the app after sign up,
// sign in, or an info update — everything the app needs to show and
// pre-fill your own info, but never the password hash or reset tokens.
function fullUser(doc) {
  return {
    name: doc.name, email: doc.email, unit: doc.unit, role: doc.role,
    condo: doc.condo, units: doc.units, dues: doc.dues, covers: doc.covers,
    mgr: doc.mgr, mgrName: doc.mgrName, reserve: doc.reserve,
    lawsuit: doc.lawsuit, quorum: doc.quorum,
    newsletter: doc.newsletter, notifyReplies: doc.notifyReplies,
  };
}

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
      user: fullUser(doc),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while signing you in." });
  }
});

// Update your own notification preference (email me when someone replies).
router.put("/me/notifications", requireLogin, async (req, res) => {
  try {
    const doc = await Registration.findById(req.user.id);
    if (!doc) return res.status(401).json({ error: "Please sign in again." });
    doc.notifyReplies = !!req.body.notifyReplies;
    await doc.save();
    res.json({ ok: true, notifyReplies: doc.notifyReplies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save that setting." });
  }
});

// Update your own info (name, unit, condo details, etc). Email and password
// aren't changed here — email stays fixed to keep sign-in simple, and
// password changes go through "forgot password" or the admin.
router.put("/me", requireLogin, async (req, res) => {
  try {
    const {
      name, unit, role, condo, units, dues, covers,
      mgr, mgrName, reserve, lawsuit, quorum, newsletter,
    } = req.body;

    if (!name || !unit || !condo) {
      return res.status(400).json({ error: "Please fill in your name, unit, and condo name." });
    }
    if (!role) return res.status(400).json({ error: "Please select what you are (owner, renter, or board member)." });
    if (!(+units > 0)) return res.status(400).json({ error: "Enter how many units are in your condo." });
    if (dues === undefined || dues === "" || !(+dues >= 0)) {
      return res.status(400).json({ error: "Enter the monthly dues, even if it is 0." });
    }
    if (!covers || !covers.length) return res.status(400).json({ error: "Select at least one thing the dues cover." });
    if (!mgr) return res.status(400).json({ error: "Please select who manages the condo." });
    if (String(mgr).indexOf("property") > -1 && !mgrName) {
      return res.status(400).json({ error: "Enter the name of your property management company." });
    }
    if (!reserve) return res.status(400).json({ error: "Please answer whether the association has a reserve fund." });
    if (!lawsuit) return res.status(400).json({ error: "Please answer whether the association is in a lawsuit." });
    if (!quorum) return res.status(400).json({ error: "Please answer how many owners are needed for a quorum." });

    const doc = await Registration.findById(req.user.id);
    if (!doc) return res.status(401).json({ error: "Please sign in again." });

    doc.name = name;
    doc.unit = unit;
    doc.role = role;
    doc.condo = condo;
    doc.units = units;
    doc.dues = dues;
    doc.covers = covers;
    doc.mgr = mgr;
    doc.mgrName = String(mgr).indexOf("property") > -1 ? mgrName : "";
    doc.reserve = reserve;
    doc.lawsuit = lawsuit;
    doc.quorum = quorum;
    doc.newsletter = !!newsletter;
    await doc.save();

    res.json({ ok: true, user: fullUser(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your changes." });
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
  const all = await Registration.find().sort({ createdAt: -1 }).select("-passwordHash -resetToken -resetTokenExpires");
  res.json(all);
});

// Admin only: a full backup of everything (registrations, posts, replies)
// as one JSON file to download and keep somewhere safe.
router.get("/admin/backup", requireLogin, requireAdmin, async (req, res) => {
  try {
    const registrations = await Registration.find().select("-passwordHash -resetToken -resetTokenExpires");
    const posts = await Post.find();
    const replies = await Reply.find();
    res.setHeader("Content-Disposition", "attachment; filename=hoa-next-door-backup-" + new Date().toISOString().slice(0, 10) + ".json");
    res.json({ exportedAt: new Date(), registrations, posts, replies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create the backup." });
  }
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
