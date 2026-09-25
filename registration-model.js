const mongoose = require("mongoose");

// One document per person who signs up. This is the data the
// registration form on the app collects.
const registrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    unit: { type: String, required: true, trim: true },
    role: { type: String, required: true }, // owner who lives here / owner who rents it out / renter / board member

    condo: { type: String, required: true, trim: true },
    units: { type: Number, required: true },
    dues: { type: Number, required: true },
    covers: { type: [String], default: [] },
    mgr: { type: String, required: true }, // the board / a property management company / not sure
    mgrName: { type: String, default: "", trim: true },
    reserve: { type: String, required: true }, // yes / no / not sure
    lawsuit: { type: String, default: "" }, // yes / no / not sure
    quorum: { type: String, default: "" }, // number, percent, or "not sure" needed for a quorum

    newsletter: { type: Boolean, default: false },
    agreedToPrivacyPolicy: { type: Boolean, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
