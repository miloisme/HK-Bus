import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
} as const;

const KMB_PRIMARY = "https://data.etabus.gov.hk/v1/transport/kmb";
/** 官方網域回 403/404 時的政府鏡像 */
const KMB_MIRROR = "https://rt.data.gov.hk/v1/transport/kmb";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // KMB proxy：繞開 CORS 與大型 payload 問題
  app.get("/api/kmb/*", async (req, res) => {
    const apiPath = req.path.replace(/^\/api\/kmb\/?/, "").replace(/\/$/, "");
    const url = `${KMB_PRIMARY}/${apiPath}`;

    try {
      const response = await fetch(url, { headers: { ...BROWSER_HEADERS, "Cache-Control": "no-cache" } });

      if (response.ok) {
        res.json(await response.json());
        return;
      }

      if (response.status === 403 || response.status === 404) {
        const fallback = await fetch(`${KMB_MIRROR}/${apiPath}`, { headers: BROWSER_HEADERS });
        if (fallback.ok) {
          res.json(await fallback.json());
          return;
        }
      }

      console.error(`KMB API ${response.status} for ${url}`);
      res.status(response.status).json({ error: `KMB API responded with ${response.status}` });
    } catch (error) {
      console.error("KMB proxy error:", error);
      res.status(502).json({ error: "Failed to fetch KMB data" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
