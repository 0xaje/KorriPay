import pino from "pino";
import { SYSTEM_NAME } from "@korripay/shared";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: "attestation",
    system: SYSTEM_NAME,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function main() {
  logger.info(
    {
      event: "service_start",
      status: "active",
    },
    "Attestation Service initialized successfully"
  );
}

main();
