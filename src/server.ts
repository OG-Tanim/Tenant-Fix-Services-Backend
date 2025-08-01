import cluster, { Worker } from "cluster";
import os from "node:os";
import { Server } from "http";
import app from "./app";
import { connectDB } from "./app/config/db";
import {
  handleUncaughtException,
  handleUnhandledRejection,
  handleShutdownSignals,
} from "./app/middleware/globalErrorHandler";
import logger from "./app/utils/logger";

// Config
const PORT = process.env.PORT || 3750;
const numCPUs = os.availableParallelism();

/**
 * Initializes and starts the Express app on a worker.
 */
const startWorker = async (): Promise<void> => {
  try {
    await connectDB();

    const server: Server = app.listen(PORT, () => {
      logger.info(`🚀 Worker ${process.pid} listening on port ${PORT}`);
    });

    // Attach graceful shutdown/error handlers
    handleUncaughtException(server);
    handleUnhandledRejection(server);
    handleShutdownSignals(server);
  } catch (error) {
    logger.error(`❌ Worker ${process.pid} failed to start`, error);
    process.exit(1);
  }
};

/**
 * Starts the cluster by forking workers.
 */
const startCluster = (): void => {
  logger.info(
    `🧠 Primary ${process.pid} is running. Forking ${numCPUs} workers...`
  );

  // Fork one worker per CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Restart dead workers
  cluster.on("exit", (worker: Worker, code: number, signal: string) => {
    const pid = worker.process.pid;

    if (signal) {
      logger.warn(`⚠️ Worker ${pid} was killed by signal: ${signal}`);
    } else if (code !== 0) {
      logger.warn(`❌ Worker ${pid} exited with code: ${code}`);
    } else {
      logger.info(`✅ Worker ${pid} exited cleanly.`);
    }

    // Restart only if error occurred
    if (code !== 0) {
      logger.info("🔁 Restarting worker...");
      cluster.fork();
    }
  });
};

//Entry point

const main = (): void => {
  if (cluster.isPrimary) {
    startCluster();
  } else {
    startWorker();
  }
};

main();
