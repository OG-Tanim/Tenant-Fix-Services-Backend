if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import router from "./index";
import notFound from "./app/middleware/notFound";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true, // Allow cookies to be sent
}));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.use("/api/v1", router);

// If no route matches, throw 404
app.use(notFound);

// Then catch all errors globally
app.use(globalErrorHandler);

export default app;
