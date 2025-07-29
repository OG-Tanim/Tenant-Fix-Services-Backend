import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./app/routes/index";
import notFound from "./app/middleware/notFound";
import globalErrorHandler from "./app/middleware/globalErrorhandler";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.use("/api/v1", router);

//Error handling middleware
app.use(globalErrorHandler);

//404 middleware
app.use(notFound);

export default app;
