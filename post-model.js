const mongoose = require("mongoose");

// One document per post in the Neighbors feed.
const postSchema = new mongoose.Schema(
  {
    authorName: { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
