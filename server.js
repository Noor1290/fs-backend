// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

dotenv.config();

// ---------- App ----------
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(cors());                // keep open CORS; tighten later if you wish
app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "images"))); // https://.../images/foo.png

// ---------- Mongo ----------
const URI = process.env.MONGODB_URI; // e.g. mongodb+srv://user:pass@cluster.iltoi.mongodb.net/lesson_market?retryWrites=true&w=majority
const DB_NAME = process.env.DB_NAME || "lesson_market";

if (!URI) {
  console.error("❌ MONGODB_URI missing. Set it in your Render Environment.");
  process.exit(1);
}

const client = new MongoClient(URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db, Lessons, Orders, dbReady = false;

async function connectWithRetry(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔌 Connecting to MongoDB (attempt ${i + 1}/${retries})...`);
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      db = client.db(DB_NAME);
      Lessons = db.collection("lessons");
      Orders  = db.collection("orders");
      dbReady = true;
      console.log("✅ Connected successfully to MongoDB Atlas");
      return;
    } catch (err) {
      dbReady = false;
      console.error("❌ MongoDB connection failed:", err?.message || err);
      if (/tls|SSL|tlsv1/i.test(String(err))) {
        console.error(
          "ℹ️  TLS hint: Use a clean SRV URI (…/lesson_market?retryWrites=true&w=majority) and allow 0.0.0.0/0 in Atlas Network Access."
        );
      }
      if (i < retries - 1) {
        const wait = Math.min(30000, 2000 * (i + 1));
        console.log(`⏳ Retrying in ${wait}ms…`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  console.error("❌ Could not connect to MongoDB after retries. API will report 503 until it connects.");
}
await connectWithRetry();

// Require DB for DB-backed routes
function requireDb(req, res, next) {
  if (!dbReady) return res.status(503).json({ error: "Database not ready" });
  next();
}

// ---------- Health / Debug ----------
app.get("/", (_req, res) => {
  res.type("text/plain").send("fs-backend is up. Try /api/health or /api/lessons");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dbReady });
});

app.get("/api/debug-connection", async (_req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
    res.json({ ok: true, message: "MongoDB connected ✅" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- API ----------
app.get("/api/lessons", requireDb, async (_req, res, next) => {
  try {
    const list = await Lessons.find({}).sort({ topic: 1, location: 1 }).toArray();
    res.json(list);
  } catch (e) { next(e); }
});

app.get("/api/search", requireDb, async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.json(await Lessons.find({}).toArray());

    const num = Number(q);
    const or = [
      { topic: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
    ];
    if (!Number.isNaN(num)) or.push({ price: num }, { space: num });

    const list = await Lessons.find({ $or: or }).toArray();
    res.json(list);
  } catch (e) { next(e); }
});

app.post("/api/orders", requireDb, async (req, res, next) => {
  try {
    const { name, phone, items } = req.body || {};
    if (!name || !/^[A-Za-z\s]+$/.test(name)) return res.status(400).json({ error: "Invalid name" });
    if (!phone || !/^\d+$/.test(phone))      return res.status(400).json({ error: "Invalid phone" });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "No items" });

    const ids = items.map(i => new ObjectId(i.lesson));
    const count = await Lessons.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) return res.status(400).json({ error: "One or more lessons not found" });

    const inserted = await Orders.insertOne({ name, phone, items, createdAt: new Date() });
    res.status(201).json({ _id: inserted.insertedId });
  } catch (e) { next(e); }
});

app.put("/api/lessons/:id", requireDb, async (req, res, next) => {
  try {
    const id = new ObjectId(req.params.id);
    const update = { ...req.body };
    delete update._id;

    const r = await Lessons.updateOne({ _id: id }, { $set: update });
    if (!r.matchedCount) return res.status(404).json({ error: "Lesson not found" });
    const doc = await Lessons.findOne({ _id: id });
    res.json(doc);
  } catch (e) { next(e); }
});

// ---------- Errors / Shutdown ----------
app.use((err, _req, res, _next) => {
  console.error("⚠️  Handler error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
});

process.on("SIGTERM", async () => {
  try { await client?.close(); } catch {}
  process.exit(0);
});

app.listen(PORT, () => console.log(`✅ API on :${PORT}`));
