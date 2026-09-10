import type { AuthenticatedUser } from "./auth";

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    csrfToken?: string;
  }
}
