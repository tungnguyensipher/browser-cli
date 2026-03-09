import type { NextFunction, Request, Response } from "express";
import { isLoopbackHost } from "@aibrowser/browser-shared";

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isMutatingMethod(method: string): boolean {
  const normalized = method.trim().toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

function isLoopbackUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") {
    return false;
  }
  try {
    return isLoopbackHost(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}

export function shouldRejectBrowserMutation(params: {
  method: string;
  origin?: string;
  referer?: string;
  secFetchSite?: string;
}): boolean {
  if (!isMutatingMethod(params.method)) {
    return false;
  }

  const secFetchSite = (params.secFetchSite ?? "").trim().toLowerCase();
  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = (params.origin ?? "").trim();
  if (origin) {
    return !isLoopbackUrl(origin);
  }

  const referer = (params.referer ?? "").trim();
  if (referer) {
    return !isLoopbackUrl(referer);
  }

  return false;
}

export function browserMutationGuardMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = (req.method || "").trim().toUpperCase();
    if (method === "OPTIONS") {
      return next();
    }

    const origin = firstHeader(req.headers.origin);
    const referer = firstHeader(req.headers.referer);
    const secFetchSite = firstHeader(req.headers["sec-fetch-site"]);
    if (shouldRejectBrowserMutation({ method, origin, referer, secFetchSite })) {
      res.status(403).send("Forbidden");
      return;
    }

    next();
  };
}
