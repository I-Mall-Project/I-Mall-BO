import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";
import allRoutes from "./routes/index.js";

const app = express();

// =============================
// 🌩️ Cloudinary Configuration
// =============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =============================
// 🌐 CORS Configuration
// =============================
const allowedOrigins = [
"https://giftshop-fo.vercel.app",
  "https://giftshop-bo.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://sandbox.sslcommerz.com",
 
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman or server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS Error: ${origin} Not Allowed`), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","token","Accept","merchantId"]
}));

// Preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, token, Accept, merchantId");
  res.sendStatus(200);
});

// =============================
// 🍪 Middleware Configuration
// =============================
app.use(cookieParser());
app.use(express.json());
app.use(express.static("public"));

// =============================
// 🚦 Routes
// =============================
app.get("/", (req, res) => {
  res.json({ msg: "GiftShop API is working..." });
});

app.use("/api", allRoutes);

// =============================
// 🧭 Server Start
// =============================
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`✅ GiftShop is running on port ${port}`);
});
