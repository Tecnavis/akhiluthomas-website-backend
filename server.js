// ==========================
// server.js
// ==========================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ==========================
// MIDDLEWARE
// ==========================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ==========================
// MONGODB CONNECTION
// ==========================
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not defined in environment variables!");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ==========================
// BLOG SCHEMA & MODEL
// ==========================
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    author: { type: String, required: true },
    date: { type: Date, default: Date.now },
    image: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// Generate unique slug
async function generateUniqueSlug(title, id = null) {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  let exists = await Blog.findOne({ slug, _id: { $ne: id } });
  let counter = 1;

  while (exists) {
    const newSlug = `${slug}-${counter}`;
    exists = await Blog.findOne({ slug: newSlug, _id: { $ne: id } });
    if (!exists) {
      slug = newSlug;
      break;
    }
    counter++;
  }

  return slug;
}

// Pre-save middleware for slug
blogSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("title")) {
    this.slug = await generateUniqueSlug(this.title, this._id);
  }
  next();
});

const Blog = mongoose.model("Blog", blogSchema);

// ==========================
// API ROUTES
// ==========================

// GET all blogs
app.get("/api/blogs", async (req, res) => {
  try {
    const { page = 1, limit = 6, search = "" } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single blog by ID
app.get("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single blog by slug
app.get("/api/blogs/slug/:slug", async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE new blog
app.post("/api/blogs", async (req, res) => {
  try {
    if (req.body.date) req.body.date = new Date(req.body.date);
    const blog = new Blog(req.body);
    await blog.save();
    res.json({ message: "Blog created successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to create blog", details: err });
  }
});

// UPDATE blog
app.put("/api/blogs/:id", async (req, res) => {
  try {
    if (req.body.date) req.body.date = new Date(req.body.date);

    if (req.body.title) {
      req.body.slug = await generateUniqueSlug(req.body.title, req.params.id);
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json({ message: "Blog updated successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to update blog", details: err });
  }
});

// DELETE blog
app.delete("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

// ==========================
// FRONTEND ROUTES (Static)
// ==========================
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// SEO-friendly blog routes (serve blog-single.html for slugs)
app.get("/blogs/:slug", (req, res) => {
  res.sendFile(path.join(publicPath, "blog-single.html"));
});

// Redirect old query style ?slug= to /blogs/:slug
app.get("/blog-single.html", (req, res) => {
  const slug = req.query.slug;
  if (slug) return res.redirect(301, `/blogs/${slug}`);
  res.sendFile(path.join(publicPath, "blog-single.html"));
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
