import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { pool } from "./db";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }));

app.use(
  express.json({
    limit: "100kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(session({
  name: "school_suite.sid",
  secret: process.env.SESSION_SECRET || (isProduction ? (() => {
    throw new Error("SESSION_SECRET must be set in production");
  })() : "development-only-session-secret"),
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false,
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/auth/login") return next();
  const now = Date.now();
  const key = req.ip || "unknown";
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return next();
  }
  if (current.count >= 10) {
    res.status(429).json({ message: "Too many login attempts" });
    return;
  }
  current.count += 1;
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
      return res.status(409).json({ message: "A record with these values already exists" });
    }

    console.error("Request failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  });

  if (isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      ...(process.platform !== "win32" ? { reusePort: true } : {}),
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
