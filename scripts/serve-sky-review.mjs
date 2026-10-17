import { createServer } from "vite";
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: ".cache/sky-review-vite",
  server: { host: "0.0.0.0", port: 5176, strictPort: true, allowedHosts: true },
  plugins: [
    {
      name: "sky-review-entry",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url === "/" || req.url?.startsWith("/?")) {
            res.writeHead(302, {
              Location: "/design/sky-creature/animation.html",
            });
            res.end();
          } else next();
        });
      },
    },
  ],
});
await server.listen();
server.printUrls();
