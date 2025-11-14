// ------------------------------------------------------------
// Load environment variables (MONGODB_URI)
// ------------------------------------------------------------
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config();

// ------------------------------------------------------------
// Connect to MongoDB using the connection string from .env
// ------------------------------------------------------------
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

// Select database and collection
const db = client.db("lesson_market");
const Lessons = db.collection("lessons");

// Clear existing lesson data before inserting fresh records
await Lessons.deleteMany({});

// Insert initial lesson documents
await Lessons.insertMany([
  { topic: "Web Design Basics",     location: "London",     price: 80,  space: 5, image: "images/Design.jpg" },
  { topic: "JavaScript Essentials", location: "Manchester", price: 95,  space: 5, image: "images/JS.jpg" },
  { topic: "Vue.js From Zero",      location: "Birmingham", price: 110, space: 5, image: "images/Network.jpg" },
  { topic: "Node & Express",        location: "Leeds",      price: 120, space: 5, image: "images/Node.jpg" },
  { topic: "Database Basics",       location: "Bristol",    price: 85,  space: 5, image: "images/Database.jpg" },
  { topic: "UI/UX Principles",      location: "Cardiff",    price: 105, space: 5, image: "images/UX.jpg" },
  { topic: "React Fundamentals",    location: "Liverpool",  price: 115, space: 5, image: "images/React.jpg" },
  { topic: "Data Structures",       location: "Sheffield",  price: 99,  space: 5, image: "images/Data_Structure.jpg" },
  { topic: "Algorithms 101",        location: "Newcastle",  price: 109, space: 5, image: "images/Algo.jpg" },
  { topic: "Cloud 101",             location: "Nottingham", price: 125, space: 5, image: "images/Cloud.jpg" },
  { topic: "Cybersecurity Intro",   location: "Leicester",  price: 130, space: 5, image: "images/Cybersecurity.jpg" },
  { topic: "Python for AI",         location: "Oxford",     price: 140, space: 5, image: "images/Python.jpg" }
]);


// Console output to confirm seeding is complete
console.log("✅ Seeded with compressed images");
console.log("✅ Seeded (native MongoDB driver)");

// Close connection and exit script
await client.close();
process.exit(0);
