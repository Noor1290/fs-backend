// order.js (native)
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI, { ignoreUndefined: true });

// Connect once and reuse
await client.connect();
const db = client.db("lesson_market");
const Orders = db.collection("orders");

export { Orders, ObjectId, client };
