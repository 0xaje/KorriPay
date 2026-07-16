import express from "express";
import { httpLogger, logger } from "./logger.js";
import { errorHandler } from "./middleware/error.js";
import { SYSTEM_NAME } from "@korripay/shared";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(httpLogger);

// Health Check Route
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: `${SYSTEM_NAME} API Gateway`,
    timestamp: new Date().toISOString(),
    correlationId: req.id,
  });
});

// Register error handling middleware (must be registered last)
app.use(errorHandler);

app.listen(port, () => {
  logger.info({ port }, `${SYSTEM_NAME} API Gateway listening on port ${port}`);
});
