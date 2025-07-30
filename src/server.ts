import { Server } from "http";
import app from "./app";
import { connectDB } from "./app/config/db";
import {
  handleUncaughtException,
  handleUnhandledRejection,
  handleShutdownSignals,
} from "./app/middleware/globalErrorHandler";

let server: Server;

const start = async (): Promise<void> => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    handleUncaughtException(server); //handles synchronous errors outside try catch block
    handleUnhandledRejection(server); //hanles rejected promises from async functions (asynchronous errors) outside try catch block
    handleShutdownSignals(server);

    console.log("Server started successfully");
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exit(1);
  }
};

// Start the server and register error handlers updated 'server' reference
start();
