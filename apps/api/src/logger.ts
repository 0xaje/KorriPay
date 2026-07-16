import pino from "pino";
import { pinoHttp } from "pino-http";
import { generateCorrelationId } from "@korripay/shared";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "api-gateway" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const id =
      req.headers["x-correlation-id"] || req.headers["x-request-id"] || generateCorrelationId();
    return id as string;
  },
  customProps: (req) => ({
    correlationId: req.id,
  }),
});
