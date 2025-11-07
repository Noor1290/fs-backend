// server.js (native driver version)
import express from "express";
import dotenv from "dotenv"; // load .env variables
import cors from "cors"; //Allows frontend to call this backend
import path from "path";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config(); //reads .env so process.env.MONGODB_URI becomes available.

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// CORS + JSON
app.use(cors());
app.use(express.json());

// Static images
app.use("/images", express.static(path.join(__dirname, "images")));

// Serve optimized WebP images
app.use(
  "/compressed_images",
  express.static(path.join(__dirname, "compressed_images"), {
    maxAge: "30d", // cache in browser for 30 days
    immutable: true,
  })
);

// Logger
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now()-t0}ms)`
    );
    if (Object.keys(req.body || {}).length) console.log("  body:", req.body);
  });
  next();
});

// Mongo connection
const client = new MongoClient(process.env.MONGODB_URI, { ignoreUndefined: true });
await client.connect();
const db = client.db("lesson_market");
const Lessons = db.collection("lessons");
const Orders  = db.collection("orders");

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// GET /lessons
app.get("/api/lessons", async (_req, res, next) => {
  try {
    const list = await Lessons.find({}).sort({ topic: 1, location: 1 }).toArray();
    res.json(list);
  } catch (e) { next(e); }
});

// Backend search (Approach 2)
app.get("/api/search", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.json(await Lessons.find({}).toArray());

    const num = Number(q);
    const or = [
      { topic:    { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
    ];
    if (!Number.isNaN(num)) {
      or.push({ price: num }, { space: num });
    }
    const list = await Lessons.find({ $or: or }).toArray();
    res.json(list);
  } catch (e) { next(e); }
});

// POST /orders
app.post("/api/orders", async (req, res, next) => {
  try {
    const { name, phone, items } = req.body || {};
    if (!name || !/^[A-Za-z\s]+$/.test(name)) return res.status(400).json({ error: "Invalid name" });
    if (!phone || !/^\d+$/.test(phone))      return res.status(400).json({ error: "Invalid phone" });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "No items" });

    // ensure lessons exist
    const ids = items.map(i => new ObjectId(i.lesson));
    const count = await Lessons.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) return res.status(400).json({ error: "One or more lessons not found" });

    // create order
    const inserted = await Orders.insertOne({ name, phone, items, createdAt: new Date() });
    res.status(201).json({ _id: inserted.insertedId });
  } catch (e) { next(e); }
});

// PUT /lessons/:id (update any attribute; used to set `space` after checkout)
app.put("/api/lessons/:id", async (req, res, next) => {
  try {
    const id = new ObjectId(req.params.id);
    const update = { ...req.body };
    if ("_id" in update) delete update._id;

    const r = await Lessons.updateOne({ _id: id }, { $set: update });
    if (!r.matchedCount) return res.status(404).json({ error: "Lesson not found" });
    const doc = await Lessons.findOne({ _id: id });
    res.json(doc);
  } catch (e) { next(e); }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => console.log(`✅ API on :${PORT}`));
