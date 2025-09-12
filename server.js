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
app.use(cors());
app.use(express.json());

// ==========================
// MONGODB CONNECTION
// ==========================
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/blogdb", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// ==========================
// BLOG SCHEMA & MODEL
// ==========================
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Date, default: Date.now }, // auto-generate if not provided
  image: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ==========================
// ROUTES
// ==========================

// GET all blogs with pagination & search
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

// CREATE new blog
app.post("/api/blogs", async (req, res) => {
  try {
    // convert date string (YYYY-MM-DD) to Date object
    if (req.body.date) {
      req.body.date = new Date(req.body.date);
    }
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
    // convert date string (YYYY-MM-DD) to Date object
    if (req.body.date) {
      req.body.date = new Date(req.body.date);
    }
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
// SERVER START
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
