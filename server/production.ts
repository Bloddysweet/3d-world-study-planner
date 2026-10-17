import { accessSync } from "node:fs";
import { resolve } from "node:path";
import { createProductionApp, listenPort } from "./app";
import { readAiConfig } from "./targets-api";

const config = readAiConfig();
const dist = resolve("dist");
try {
  accessSync(resolve(dist, "index.html"));
} catch {
  throw Error(
    "The website build is missing. Run npm run build before npm start.",
  );
}
const port = listenPort();
const server = createProductionApp(config, dist).listen(port, "0.0.0.0", () => {
  console.log(`Study World listening on port ${port}`);
});
server.requestTimeout = 80000;
server.headersTimeout = 15000;
server.on("error", () => {
  console.error("The web server could not start. Check the configured port.");
  process.exitCode = 1;
});
