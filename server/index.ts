import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

const app = express();
const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

if (isProduction) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
});

app.use(
  express.json({
    limit: "100kb",
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb",
  }),
);

app.use(
  session({
    name: "school_suite.sid",
    secret:
      process.env.SESSION_SECRET ||
      "development-only-session-secret",
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
  }),
);

const loginAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();

app.use((req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/auth/login") {
    next();
    return;
  }

  const now = Date.now();
  const key = req.ip || "unknown";
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, {
      count: 1,
      resetAt: now + 15 * 60 * 1000,
    });
    next();
    return;
  }

  if (current.count >= 10) {
    res.status(429).json({
      message: "Too many login attempts",
    });
    return;
  }

  current.count += 1;
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (!path.startsWith("/api")) {
      return;
    }

    const duration = Date.now() - start;
    log(
      `${req.method} ${path} ${res.statusCode} in ${duration}ms`,
    );
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use(
      (
        err: unknown,
        _req: Request,
        res: Response,
        next: NextFunction,
      ) => {
        if (res.headersSent) {
          next(err);
          return;
        }

        if (err instanceof z.ZodError) {
          res.status(400).json({
            message: "Invalid request",
          });
          return;
        }

        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "23505"
        ) {
          res.status(409).json({
            message: "A record with these values already exists",
          });
          return;
        }

        console.error("Request failed:", err);

        res.status(500).json({
          message: "Internal server error",
        });
      },
    );

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = Number.parseInt(
      process.env.PORT || "3000",
      10,
    );

    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
})();
