import signale from "signale";
import { ServiceInfo } from "../domain/service.js";
import { get_services_controller } from "./di.js";
import { Router, Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router = Router();

export async function set_services(): Promise<Router> {
    const services = await get_services_controller.run();

    for (const service of services) {
        const target = process.env[service.target_service.host_var];
        if (!target) {
            signale.warn(`Host variable ${service.target_service.host_var} not found in environment for service ${service.id}`);
            continue;
        }

        const fullTarget = new URL(service.target_service.base_path, target).href;
        signale.info(`Configuring proxy for ${service.id}: ${service.gateway_prefix} -> ${fullTarget}`);

        // ⚡ Configuración básica del proxy
        const proxyOptions = {
            target: fullTarget,
            changeOrigin: true,
            timeout: service.timeouts.read_ms || 30000,
            proxyTimeout: service.timeouts.connect_ms || 10000,
            
            // 🔧 PATHREWRITE simplificado
            pathRewrite: (path: string, req: any) => {
                signale.debug(`Original path: ${path}`);
                
                // Caso especial: Health check del Auth Service
                if (service.id === 'auth-service' && path === '/api/health') {
                    signale.debug(`Health check rewrite: ${path} -> /health`);
                    return '/health';
                }
                
                // Reescritura normal: quita el gateway_prefix
                if (path.startsWith(service.gateway_prefix)) {
                    const rewrittenPath = path.substring(service.gateway_prefix.length) || "/";
                    signale.debug(`Normal rewrite: ${path} -> ${rewrittenPath}`);
                    return rewrittenPath;
                }
                
                return path;
            },

            // 🚨 MANEJO DE ERRORES simplificado
            onError: (err: any, req: any, res: any, target?: any) => {
                signale.error(`Proxy error for ${service.id}:`, {
                    error: err.message,
                    code: err.code,
                    target: target,
                    path: req.path,
                    method: req.method
                });

                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Service Unavailable',
                        message: `Unable to connect to ${service.id}`,
                        service: service.id,
                        timestamp: new Date().toISOString()
                    });
                }
            },

            // 📊 LOGGING básico
            onProxyReq: (proxyReq: any, req: any, res: any, options: any) => {
                signale.info(`🔄 Proxying: ${req.method} ${req.path} -> ${options.target}${proxyReq.path || ''}`);
            },

            onProxyRes: (proxyRes: any, req: any, res: any) => {
                signale.info(`✅ Response: ${proxyRes.statusCode} for ${req.method} ${req.path}`);
            },

            // 🔒 Configuración segura
            secure: true,
            logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
        };

        const proxy = createProxyMiddleware(proxyOptions);

        // Registrar cada ruta del servicio
        for (const route of service.routes) {
            const methods = route.methods.map(m => m.toLowerCase());

            // 🔐 Middleware de autenticación
            const authMiddleware = route.auth_required
                ? (req: Request, res: Response, next: NextFunction) => {
                      const authHeader = req.headers.authorization;
                      
                      if (!authHeader || !authHeader.startsWith('Bearer ')) {
                          return res.status(401).json({
                              error: 'Unauthorized',
                              message: 'Bearer token required',
                              service: service.id,
                              endpoint: route.route
                          });
                      }
                      
                      next();
                  }
                : (req: Request, res: Response, next: NextFunction) => {
                      next();
                  };

            const fullPath = service.gateway_prefix + route.route;
            signale.debug(`Registering route: ${methods.join(',')} ${fullPath}`);

            // Registrar cada método HTTP
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

        signale.success(`✅ Service ${service.id} configured with ${service.routes.length} routes`);
    }

    signale.success(`🚀 Gateway configured with ${services.length} services`);
    return router;
}