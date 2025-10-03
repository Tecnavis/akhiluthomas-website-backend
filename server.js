// ==========================
// server.js
// ==================================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
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
    slug: { type: String, unique: true }, // FIX: removed "required: true"
    author: { type: String, required: true },
    date: { type: Date, default: Date.now },
    image: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// Slug generator middleware (ensures unique slug if missing)
blogSchema.pre("save", async function (next) {
  if (!this.isModified("title") && this.slug) return next();

  let baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  let slug = baseSlug;
  let count = 1;

  while (await mongoose.models.Blog.findOne({ slug })) {
    slug = `${baseSlug}-${count++}`;
  }

  this.slug = slug;
  next();
});

const Blog = mongoose.model("Blog", blogSchema);

// ==========================
// ROUTES
// ==========================

// GET all blogs (with pagination + search)
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

// GET total blog count
app.get("/api/blogs/count", async (req, res) => {
  try {
    const { search = "" } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }
    const count = await Blog.countDocuments(query);
    res.json({ count });
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

    // Generate slug manually if missing
    if (!req.body.slug && req.body.title) {
      let baseSlug = req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      let slug = baseSlug;
      let count = 1;

      while (await Blog.findOne({ slug })) {
        slug = `${baseSlug}-${count++}`;
      }
      req.body.slug = slug;
    }

    const blog = new Blog(req.body);
    await blog.save();
    res.json({ message: "Blog created successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to create blog", details: err.message });
  }
});

// UPDATE blog
app.put("/api/blogs/:id", async (req, res) => {
  try {
    if (req.body.date) req.body.date = new Date(req.body.date);

    // If title changes, regenerate unique slug
    if (req.body.title) {
      let baseSlug = req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      let slug = baseSlug;
      let count = 1;

      while (await Blog.findOne({ slug, _id: { $ne: req.params.id } })) {
        slug = `${baseSlug}-${count++}`;
      }
      req.body.slug = slug;
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json({ message: "Blog updated successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to update blog", details: err.message });
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
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
