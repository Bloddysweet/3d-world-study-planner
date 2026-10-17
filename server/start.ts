import { createServer } from "node:http";
import { createTargetsMiddleware, readAiConfig } from "./targets-api";
const handle = createTargetsMiddleware(readAiConfig());
const server = createServer((req, res) => {
  void handle(req, res, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
});
server.requestTimeout = 80000;
server.headersTimeout = 15000;
server.listen(Number(process.env.AI_API_PORT) || 3001, "0.0.0.0", () =>
  console.log(
    "Private targets API listening on port " +
      (process.env.AI_API_PORT || 3001),
  ),
);
