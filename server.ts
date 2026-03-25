import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy for KMB API to avoid CORS and handle large payload
  app.get("/api/kmb/*", async (req, res) => {
    try {
      const apiPath = req.params[0].replace(/\/$/, ""); // Remove trailing slash
      // Use official KMB domain as primary (it has all endpoints like /stop and /route)
      const url = `https://data.etabus.gov.hk/v1/transport/kmb/${apiPath}`;
      console.log(`Proxying KMB request to: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error(`KMB API error: ${response.status} for ${url}`);
        
        // If official domain fails (e.g. 403 or 404), try the government mirror as fallback
        if (response.status === 403 || response.status === 404) {
          const fallbackUrl = `https://rt.data.gov.hk/v1/transport/kmb/${apiPath}`;
          console.log(`Retrying with government mirror: ${fallbackUrl}`);
          const fallbackRes = await fetch(fallbackUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            return res.json(data);
          }
        }
        return res.status(response.status).json({ error: `KMB API responded with ${response.status}` });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch KMB data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
