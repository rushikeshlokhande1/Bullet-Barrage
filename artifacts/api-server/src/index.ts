import app from "./app";
import { createGameServer } from "./gameServer";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createGameServer(app);

httpServer.listen(port, () => {
  logger.info({ port }, "Game server listening");
});
