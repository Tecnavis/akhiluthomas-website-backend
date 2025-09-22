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
    title: { type: String, required: [true, "Title is required"] },
    slug: { type: String, unique: true, required: true },
    author: { type: String, required: [true, "Author is required"] },
    date: { type: Date, default: Date.now },
    image: { type: String, required: [true, "Image URL is required"] },
    summary: { type: String, required: [true, "Summary is required"] },
    content: { type: String, required: [true, "Content is required"] },
  },
  { timestamps: true }
);

// Slug generator middleware (ensures unique slug)
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

// GET all blogs (with search + pagination)
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
    console.error("❌ Get Blogs Error:", err.message);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// GET total blog count (for pagination)
app.get("/api/blogs/count", async (req, res) => {
  try {
    const count = await Blog.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("❌ Blog Count Error:", err.message);
    res.status(500).json({ error: "Failed to fetch blog count" });
  }
});

// GET single blog by slug
app.get("/api/blogs/slug/:slug", async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    console.error("❌ Get Blog Error:", err.message);
    res.status(500).json({ error: "Failed to fetch blog" });
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
    console.error("❌ Blog Save Error:", err.message);

    // Duplicate slug/title
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "A blog with this title already exists. Please choose another title." });
    }

    // Validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(400).json({ error: "Something went wrong while creating the blog." });
  }
});

// UPDATE blog
app.put("/api/blogs/:id", async (req, res) => {
  try {
    if (req.body.date) req.body.date = new Date(req.body.date);

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

    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!blog) return res.status(404).json({ error: "Blog not found" });

    res.json({ message: "Blog updated successfully", blog });
  } catch (err) {
    console.error("❌ Blog Update Error:", err.message);

    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "A blog with this title already exists. Please choose another title." });
    }

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(400).json({ error: "Something went wrong while updating the blog." });
  }
});

// DELETE blog
app.delete("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error("❌ Blog Delete Error:", err.message);
    res.status(500).json({ error: "Something went wrong while deleting the blog." });
  }
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
