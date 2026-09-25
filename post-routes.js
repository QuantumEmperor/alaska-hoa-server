const express = require("express");
const Post = require("./post-model");
const Reply = require("./reply-model");
const Registration = require("./registration-model");
const { requireLogin } = require("./auth-middleware");

const router = express.Router();

// Shows other neighbors a first name and last initial only, not a full
// last name, matching what the Privacy Policy tells people to expect.
function displayName(fullName) {
  var parts = String(fullName || "Neighbor").trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  return parts[0] + " " + parts[parts.length - 1].charAt(0).toUpperCase() + ".";
}

function isAdminEmail(email) {
  return String(email || "").toLowerCase() === (process.env.ADMIN_EMAIL || "").toLowerCase();
}

// List posts, newest first. Any signed-in person can see them.
router.get("/", requireLogin, async (req, res) => {
  try {
    var admin = isAdminEmail(req.user.email);
    var posts = await Post.find().sort({ createdAt: -1 }).limit(200);
    res.json(
      posts.map(function (p) {
        return {
          id: p._id,
          name: displayName(p.authorName),
          category: p.category,
          body: p.body,
          createdAt: p.createdAt,
          replyCount: p.replyCount || 0,
          canDelete: admin || p.authorEmail === String(req.user.email || "").toLowerCase(),
          canEdit: p.authorEmail === String(req.user.email || "").toLowerCase(),
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the feed." });
  }
});

// Create a new post. Any signed-in person can post.
router.post("/", requireLogin, async (req, res) => {
  try {
    var body = String(req.body.body || "").trim();
    var category = String(req.body.category || "").trim();
    if (!body) return res.status(400).json({ error: "Write something first." });
    if (body.length > 130) return res.status(400).json({ error: "Please keep it to 130 characters or fewer." });
    if (!category) return res.status(400).json({ error: "Pick a category." });

    var author = await Registration.findById(req.user.id);
    if (!author) return res.status(401).json({ error: "Please sign in again." });

    var post = await Post.create({ authorName: author.name, authorEmail: author.email, category: category, body: body });
    res.status(201).json({
      id: post._id,
      name: displayName(post.authorName),
      category: post.category,
      body: post.body,
      createdAt: post.createdAt,
      replyCount: 0,
      canDelete: true,
      canEdit: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your post." });
  }
});

// Edit a post. Only the post's own author can do this (not even the admin,
// so nobody's words get changed except by the person who wrote them).
router.put("/:id", requireLogin, async (req, res) => {
  try {
    var post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "That post no longer exists." });
    if (post.authorEmail !== String(req.user.email || "").toLowerCase()) {
      return res.status(403).json({ error: "You can only edit your own posts." });
    }
    var body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "Write something first." });
    if (body.length > 130) return res.status(400).json({ error: "Please keep it to 130 characters or fewer." });
    post.body = body;
    await post.save();
    res.json({
      id: post._id,
      name: displayName(post.authorName),
      category: post.category,
      body: post.body,
      createdAt: post.createdAt,
      replyCount: post.replyCount || 0,
      canDelete: true,
      canEdit: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your changes." });
  }
});

// Delete a post (and its replies). Only the post's own author or the admin can do this.
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    var post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "That post no longer exists." });
    var allowed = isAdminEmail(req.user.email) || post.authorEmail === String(req.user.email || "").toLowerCase();
    if (!allowed) return res.status(403).json({ error: "You can only delete your own posts." });
    await Reply.deleteMany({ postId: post._id });
    await Post.deleteOne({ _id: post._id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete that post." });
  }
});

// List replies to a post, oldest first (like a conversation).
router.get("/:id/replies", requireLogin, async (req, res) => {
  try {
    var admin = isAdminEmail(req.user.email);
    var replies = await Reply.find({ postId: req.params.id }).sort({ createdAt: 1 });
    res.json(
      replies.map(function (r) {
        return {
          id: r._id,
          name: displayName(r.authorName),
          body: r.body,
          createdAt: r.createdAt,
          canDelete: admin || r.authorEmail === String(req.user.email || "").toLowerCase(),
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load replies." });
  }
});

// Add a reply to a post. Any signed-in person can reply.
router.post("/:id/replies", requireLogin, async (req, res) => {
  try {
    var body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "Write something first." });
    if (body.length > 130) return res.status(400).json({ error: "Please keep it to 130 characters or fewer." });

    var post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "That post no longer exists." });

    var author = await Registration.findById(req.user.id);
    if (!author) return res.status(401).json({ error: "Please sign in again." });

    var reply = await Reply.create({ postId: post._id, authorName: author.name, authorEmail: author.email, body: body });
    post.replyCount = (post.replyCount || 0) + 1;
    await post.save();

    res.status(201).json({
      id: reply._id,
      name: displayName(reply.authorName),
      body: reply.body,
      createdAt: reply.createdAt,
      canDelete: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your reply." });
  }
});

// Delete a reply. Only the reply's own author or the admin can do this.
router.delete("/:id/replies/:replyId", requireLogin, async (req, res) => {
  try {
    var reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ error: "That reply no longer exists." });
    var allowed = isAdminEmail(req.user.email) || reply.authorEmail === String(req.user.email || "").toLowerCase();
    if (!allowed) return res.status(403).json({ error: "You can only delete your own replies." });
    await Reply.deleteOne({ _id: reply._id });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { replyCount: -1 } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete that reply." });
  }
});

module.exports = router;
