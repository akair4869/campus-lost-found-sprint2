import { createApplication } from "../server.mjs";
const app = createApplication();
app.seedDemo();
const args = process.argv.slice(2);
const port = Number(
  process.env.PORT ||
    (args.includes("--port") ? args[args.indexOf("--port") + 1] : 3000),
);
const host =
  process.env.HOST ||
  (args.includes("--host") ? args[args.indexOf("--host") + 1] : "127.0.0.1");
app.server.listen(port, host, () =>
  console.log(
    `Campus Lost & Found: http://localhost:${port}\nDemo accounts are listed in README.md. Press Ctrl+C to stop.`,
  ),
);
