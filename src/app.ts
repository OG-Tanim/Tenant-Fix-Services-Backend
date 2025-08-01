if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./app/routes/index";
import notFound from "./app/middleware/notFound";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";

dotenv.config();

const app = express();

app.use(cors());
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
