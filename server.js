import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(cors());
app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "images")));

// ===============================
// 🧩 GLOBAL MONGO CLIENT (accessible everywhere)
// ===============================
let client, db, Lessons, Orders;

try {
  client = new MongoClient(process.env.MONGODB_URI, {
    ssl: true,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  console.log("Connecting to MongoDB Atlas...");
  await client.connect(); // 🔥 required
  await client.db("admin").command({ ping: 1 });
  console.log("✅ Connected successfully to MongoDB Atlas");

  db = client.db("lesson_market");
  Lessons = db.collection("lessons");
  Orders = db.collection("orders");
} catch (err) {
  console.error("❌ MongoDB connection failed:", err);
}

app.get("/api/debug-connection", async (_req, res) => {
  try {
    if (!client) return res.status(500).json({ ok: false, error: "Client not initialized" });
    await client.db().command({ ping: 1 });
    res.json({ ok: true, message: "MongoDB connected successfully ✅" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


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
