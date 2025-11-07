// lesson.js (native)
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

// Create a single shared connection
const client = new MongoClient(process.env.MONGODB_URI, { ignoreUndefined: true });
await client.connect();

const db = client.db("lesson_market");// 👈 Database name
const Lessons = db.collection("lessons"); // 👈 Collection name

export { Lessons, client };
