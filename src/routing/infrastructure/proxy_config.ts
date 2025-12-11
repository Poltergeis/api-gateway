import signale from "signale";
import { get_services_controller } from "./di.js";
import { Router, Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router = Router();

export async function set_services(): Promise<Router> {
  const services = await get_services_controller.run();

  for (const service of services) {
    const target = process.env[service.target_service.host_var];
    if (!target) {
      signale.warn(
        `Host variable ${service.target_service.host_var} not found in environment for service ${service.id}`
      );
      continue;
    }

    const fullTarget = new URL(service.target_service.base_path, target).href;
    signale.info(
      `Configuring proxy for ${service.id}: ${service.gateway_prefix} -> ${fullTarget}`
    );

    const readTimeout = service.timeouts.read_ms || 30000;
    const connectTimeout = service.timeouts.connect_ms || 10000;

    signale.info(
      `Service ${service.id} timeouts: connect=${connectTimeout}ms, read=${readTimeout}ms`
    );

    const proxyOptions = {
      target: fullTarget,
      changeOrigin: true,
      timeout: readTimeout,
      proxyTimeout: connectTimeout,

      pathRewrite: (path: string, req: any) => {
        signale.debug(`Original path: ${path}`);

        if (service.id === "auth-service" && path === "/api/health") {
          signale.debug(`Health check rewrite: ${path} -> /health`);
          return "/health";
        }

        if (path.startsWith(service.gateway_prefix)) {
          const rewrittenPath =
            path.substring(service.gateway_prefix.length) || "/";
          signale.debug(`Normal rewrite: ${path} -> ${rewrittenPath}`);
          return rewrittenPath;
        }

        return path;
      },

      onError: (err: any, req: any, res: any, target?: any) => {
        signale.error(`Proxy error for ${service.id}:`, {
          error: err.message,
          code: err.code,
          target: target,
          path: req.path,
          method: req.method,
          timeout_used: readTimeout,
          connect_timeout: connectTimeout,
        });

        if (!res.headersSent) {
          if (
            err.code === "ECONNRESET" ||
            err.code === "ETIMEDOUT" ||
            err.message.includes("timeout")
          ) {
            res.status(504).json({
              error: "Gateway Timeout",
              message: `${service.id} took too long to respond (timeout: ${readTimeout}ms)`,
              service: service.id,
              timestamp: new Date().toISOString(),
              suggestion:
                "The operation is taking longer than expected. Please try again or contact support.",
            });
          } else if (err.code === "ECONNREFUSED") {
            res.status(503).json({
              error: "Service Unavailable",
              message: `Unable to connect to ${service.id}. Service may be down.`,
              service: service.id,
              timestamp: new Date().toISOString(),
            });
          } else {
            res.status(502).json({
              error: "Bad Gateway",
              message: `Error communicating with ${service.id}`,
              service: service.id,
              timestamp: new Date().toISOString(),
            });
          }
        }
      },

      onProxyReq: (proxyReq: any, req: any, res: any, options: any) => {
        // [IMPLANTACIÓN DEL CUERPO PARSEADO]
        const body = (req as any).rawBody; // Capturamos el buffer que guardamos en express.json()

        // Solo aplicar la lógica a peticiones que tengan cuerpo (POST, PUT, PATCH, etc.)
        if (body && req.method !== "GET" && req.method !== "HEAD") {
          proxyReq.setHeader("Content-Length", Buffer.byteLength(body));

          // Escribir el buffer original en la petición proxy
          proxyReq.write(body);

          signale.debug(
            `Raw body buffer re-injected for ${req.method} ${req.path}`
          );
        }

        const isLongRunning = req.path.includes("/finish");
        if (isLongRunning) {
          signale.info(
            `[LONG REQUEST] Proxying: ${req.method} ${req.path} -> ${
              options.target
            }${proxyReq.path || ""} (timeout: ${readTimeout}ms)`
          );
        } else {
          signale.info(
            `Proxying: ${req.method} ${req.path} -> ${options.target}${
              proxyReq.path || ""
            }`
          );
        }
      },

      onProxyRes: (proxyRes: any, req: any, res: any) => {
        const isLongRunning = req.path.includes("/finish");
        if (isLongRunning) {
          signale.success(
            `[LONG REQUEST] Response: ${proxyRes.statusCode} for ${req.method} ${req.path}`
          );
        } else {
          signale.info(
            `Response: ${proxyRes.statusCode} for ${req.method} ${req.path}`
          );
        }
      },

      secure: false,
      logLevel: process.env.NODE_ENV === "development" ? "debug" : "warn",

      headers: {
        Connection: "keep-alive",
        "Keep-Alive": "timeout=180",
      },
    };

    const proxy = createProxyMiddleware(proxyOptions);

    for (const route of service.routes) {
      const methods = route.methods.map((m) => m.toLowerCase());

      const authMiddleware = route.auth_required
        ? (req: Request, res: Response, next: NextFunction) => {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
              return res.status(401).json({
                error: "Unauthorized",
                message: "Bearer token required",
                service: service.id,
                endpoint: route.route,
              });
            }

            next();
          }
        : (req: Request, res: Response, next: NextFunction) => {
            next();
          };

      const fullPath = service.gateway_prefix + route.route;
      signale.debug(`Registering route: ${methods.join(",")} ${fullPath}`);

      for (const method of methods) {
        switch (method) {
          case "get":
            router.get(fullPath, authMiddleware, proxy);
            break;
          case "post":
            router.post(fullPath, authMiddleware, proxy);
            break;
          case "put":
            router.put(fullPath, authMiddleware, proxy);
            break;
          case "delete":
            router.delete(fullPath, authMiddleware, proxy);
            break;
          case "patch":
            router.patch(fullPath, authMiddleware, proxy);
            break;
          case "options":
            router.options(fullPath, authMiddleware, proxy);
            break;
          default:
            signale.warn(`Unsupported HTTP method: ${method}`);
        }
      }
    }

    signale.success(
      `Service ${service.id} configured with ${service.routes.length} routes (timeouts: ${connectTimeout}ms/${readTimeout}ms)`
    );
  }

  signale.success(`Gateway configured with ${services.length} services`);
  return router;
}
