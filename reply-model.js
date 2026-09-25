const mongoose = require("mongoose");

// One document per reply to a post in the Neighbors feed.
const replySchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    authorName: { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, trim: true, lowercase: true },
    body: { type: String, required: true, trim: true, maxlength: 130 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reply", replySchema);
