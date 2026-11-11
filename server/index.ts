import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureSuperAdmin } from "./seed";

const app = express();

// CORS (Phase 2 design §1): PC (Electron) aur Android (Capacitor) clients
// browser nahi hain aur JWT Authorization header me bhejte hain, isliye
// header-based CORS kaafi hai. CORS_ORIGIN env set ho to wahi origin,
// warna request ka apna Origin echo hota hai.
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Phase 3 Batch C — documents base64 JSON body me aate hain (~2MB ki
// file = ~2.7MB base64), isliye JSON limit 4mb rakhi hai. Isse badi
// body Express 413 dega; asal 2MB wali limit routes me saaf message
// ke saath lagti hai.
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalJson = res.json.bind(res);
  res.json = ((bodyJson: unknown, ...args: unknown[]) => {
    capturedJsonResponse = bodyJson as Record<string, unknown> | undefined;
    return originalJson(bodyJson, ...(args as []));
  }) as typeof res.json;

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;

    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    if (logLine.length > 140) {
      logLine = `${logLine.slice(0, 137)}...`;
    }
    log(logLine);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error(err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);

    // Boot-time Super Admin seed (FREE RENDER DEPLOY): Render free
    // plan par shell nahi milta, isliye seed CLI nahi chal sakta —
    // pehla Super Admin yahin, listen ke turant baad banta hai.
    // ensureSuperAdmin() idempotent hai (super_admin pehle se ho
    // to no-op) aur andar se kabhi throw nahi karta; phir bhi
    // yahan try/catch hai taaki seed ki koi bhi gadbad API server
    // ko kabhi na giraye — server chalta rahega, bas log hoga.
    void (async () => {
      try {
        await ensureSuperAdmin();
      } catch (err) {
        console.error(
          "Super Admin boot-seed failed (server chalta rahega):",
          err,
        );
      }
    })();
  });
})();
