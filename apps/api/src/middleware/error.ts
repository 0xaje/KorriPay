import { ErrorRequestHandler } from "express";
import { ApplicationError } from "@korripay/errors";
import { logger } from "../logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = req.id;

  if (err instanceof ApplicationError) {
    logger.warn(
      {
        err: {
          name: err.name,
          message: err.message,
          code: err.code,
          statusCode: err.statusCode,
          details: err.details,
          stack: err.stack,
        },
        correlationId,
      },
      "Application error occurred"
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        correlationId,
      },
    });
    return;
  }

  // Handle native / unknown errors
  logger.error(
    {
      err: {
        name: err.name || "Error",
        message: err.message || "Unknown error",
        stack: err.stack,
      },
      correlationId,
    },
    "Unhandled exception occurred"
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred",
      correlationId,
    },
  });
};
