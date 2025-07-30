import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./app/routes/index";
import notFound from "./app/utils/notFound";
import { globalErrorHandler } from "./app/utils/globalErrorHandler";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.use("/api/v1", router);

// If no route matches, throw 404
app.use(notFound);

// Then catch all errors globally
app.use(globalErrorHandler);

export default app;
