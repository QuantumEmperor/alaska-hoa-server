const express = require("express");
const Post = require("./post-model");
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

// List posts, newest first. Any signed-in person can see them.
router.get("/", requireLogin, async (req, res) => {
  try {
    var posts = await Post.find().sort({ createdAt: -1 }).limit(200);
    res.json(
      posts.map(function (p) {
        return {
          id: p._id,
          name: displayName(p.authorName),
          category: p.category,
          body: p.body,
          createdAt: p.createdAt,
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your post." });
  }
});

module.exports = router;
