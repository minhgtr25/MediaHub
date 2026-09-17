import { app } from "./app.mjs";
import { env } from "./config/database.js";
const server = app.listen(env.PORT, () =>
  console.info(`MediaHub API listening on ${env.PORT}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close((error) => {
    if (error) process.exitCode = 1;
  });
  setTimeout(() => {
    server.closeAllConnections();
  }, 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
