const mongoose = require("mongoose");

// One document per person who signs up. This is the data the
// registration form on the app collects.
const registrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    unit: { type: String, default: "", trim: true }, // optional at sign-up
    role: { type: String, required: true }, // owner who lives here / owner who rents it out / renter / board member

    condo: { type: String, required: true, trim: true },

    // Everything below is filled in on the "build your HOA's profile" step
    // after sign-up (or later from "Edit info") — none of it is required to join.
    units: { type: Number, default: null },
    dues: { type: Number, default: null },
    covers: { type: [String], default: [] },
    mgr: { type: String, default: "" }, // the board / a property management company / not sure
    mgrName: { type: String, default: "", trim: true },
    reserve: { type: String, default: "" }, // yes / no / not sure
    lawsuit: { type: String, default: "" }, // yes / no / not sure
    quorum: { type: String, default: "" }, // number, percent, or "not sure" needed for a quorum

    newsletter: { type: Boolean, default: false },
    agreedToPrivacyPolicy: { type: Boolean, required: true },

    // Whether to email this person when someone replies to their post.
    notifyReplies: { type: Boolean, default: true },

    // Set only while a "forgot password" reset is in progress; cleared once used.
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
