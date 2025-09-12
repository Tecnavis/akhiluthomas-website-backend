// ==========================
// server.js
// ==========================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ==========================
// MIDDLEWARE
// ==========================
app.use(cors({ origin: "*" })); // Allow all origins for now, you can restrict to your frontend URL
app.use(express.json());

// ==========================
// MONGODB CONNECTION
// ==========================
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not defined in environment variables!");
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ==========================
// BLOG SCHEMA & MODEL
// ==========================
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Date, default: Date.now },
  image: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ==========================
// ROUTES
// ==========================

// GET all blogs
app.get("/api/blogs", async (req, res) => {
  try {
    const { page = 1, limit = 6, search = "" } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } }
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

// GET single blog
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
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
