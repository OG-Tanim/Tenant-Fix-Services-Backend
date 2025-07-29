import { Server } from "http";
import app from "./app";
import { connectDB } from "./app/config/db";

let server: Server;
const start = async (): Promise<void> => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;

    // assign app as value to server
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exit(1);
  }
};

start();

// -------Error & Signal Handler-------

process.on("unhandledRejection", (error: Error) => {
  console.error("Unhandled Rejection:", error);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// system sends termination signal
process.on("SIGINT", () => {
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// terminal shutdoown
process.on("SIGTERM", () => {
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
