import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = contentTypes[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestPath = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.normalize(path.join(distDir, normalizedPath));

  if (!targetPath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(targetPath);

    if (fileStat.isFile()) {
      sendFile(targetPath, res);
      return;
    }
  } catch {
    // Fall through to SPA index.html when the file does not exist.
  }

  if (existsSync(indexFile)) {
    sendFile(indexFile, res);
    return;
  }

  res.writeHead(404);
  res.end("Build output not found. Run `npm run build` first.");
});

server.listen(port, () => {
  console.log(`Second Brain web server listening on port ${port}`);
});
