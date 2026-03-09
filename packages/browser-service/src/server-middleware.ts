import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { browserMutationGuardMiddleware } from "./csrf.js";
import { isAuthorizedBrowserRequest } from "./http-auth.js";

export function installBrowserCommonMiddleware(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ctrl = new AbortController();
    const abort = () => ctrl.abort(new Error("request aborted"));
    req.once("aborted", abort);
    res.once("close", () => {
      if (!res.writableEnded) {
        abort();
      }
    });
    // Make the signal available to browser route handlers (best-effort).
    (req as unknown as { signal?: AbortSignal }).signal = ctrl.signal;
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(browserMutationGuardMiddleware());
}

export function installBrowserAuthMiddleware(
  app: Express,
  auth: { token?: string; password?: string },
) {
  if (!auth.token && !auth.password) {
    return;
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isAuthorizedBrowserRequest(req, auth)) {
      return next();
    }
    res.status(401).send("Unauthorized");
  });
}
