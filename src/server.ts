import app from "./app";
import { connectDB } from "./app/config/db";

const start = async () => {
  try {
    await connectDB();

    app.listen(process.env.port, () => {
      console.log(`Server is running on port ${process.env.port}`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exit(1);
  }
};

start();
