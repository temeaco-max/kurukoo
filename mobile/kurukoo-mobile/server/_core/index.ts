import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getCapabilityPortfolio } from "./osCapabilityService";
import { getArtifactById } from "../db";
import { downloadFromGoogleDrive } from "./googleDriveService";
import { storageGetSignedUrl } from "../storage";
import { beginGoogleDriveAuthorization, completeGoogleDriveAuthorization } from "./googleDriveService";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/connect/google/authorize", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) { res.status(401).json({ error: "Authentication required to connect Google Drive." }); return; }
      const result = await beginGoogleDriveAuthorization(user.id);
      res.redirect(result.authorizationUrl);
    } catch (error) {
      res.status(412).json({ error: error instanceof Error ? error.message : "Google Drive is not ready to connect." });
    }
  });

  app.get("/api/connect/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const error = typeof req.query.error === "string" ? req.query.error : undefined;
    const successRedirect = process.env.GOOGLE_DRIVE_POST_AUTH_REDIRECT || "kurukoo://surface/connect?drive=connected";
    if (error || !code || !state) { res.redirect(`${successRedirect.split("?")[0]}?drive=error`); return; }
    try {
      await completeGoogleDriveAuthorization(code, state);
      res.redirect(successRedirect);
    } catch {
      res.redirect(`${successRedirect.split("?")[0]}?drive=error`);
    }
  });

  app.get("/api/os/artifacts/:id/content", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const artifactId = Number(req.params.id);
      if (!user || !Number.isInteger(artifactId)) { res.status(401).json({ error: "Authentication required to retrieve this artifact." }); return; }
      const artifact = await getArtifactById(artifactId, user.id);
      if (!artifact) { res.status(404).json({ error: "Artifact not found for this account." }); return; }
      if (artifact.storageProvider === "google-drive" && artifact.externalObjectId) {
        const media = await downloadFromGoogleDrive(user.id, artifact.externalObjectId);
        res.setHeader("Content-Type", media.contentType);
        res.setHeader("Cache-Control", "private, max-age=300");
        res.send(media.bytes);
        return;
      }
      const signedUrl = await storageGetSignedUrl(artifact.storageKey);
      res.redirect(signedUrl);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Artifact retrieval is unavailable." });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get("/api/os/portfolio", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required to inspect capability state." });
        return;
      }
      res.json(await getCapabilityPortfolio(user.id));
    } catch {
      res.status(401).json({ error: "Authentication required to inspect capability state." });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
