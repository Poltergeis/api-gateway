import signale from "signale";
import { ServiceInfo } from "../domain/service.js";
import { get_services_controller } from "./di.js";
import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import handlers from "./handlers/handlers.js";

const router = Router();

export async function set_services() {
    const services = await get_services_controller.run();

    for (const service of services) {
        const target = process.env[service.target_service.host_var];
        if (!target) {
            console.warn(`Host variable ${service.target_service.host_var} not found in environment for service ${service.id}`);
            continue;
        }

        const fullTarget = new URL(service.target_service.base_path, target).href;

        // Configuración básica del proxy
        const proxyOptions = {
            target: fullTarget,
            changeOrigin: true,
            timeout: service.timeouts.read_ms,
            proxyTimeout: service.timeouts.connect_ms,
            pathRewrite: (path: string) => {
                // Elimina el gateway_prefix del path antes de enviar al target
                if (path.startsWith(service.gateway_prefix)) {
                    return path.substring(service.gateway_prefix.length) || "/";
                }
                return path;
            },
        };

        const proxy = createProxyMiddleware(proxyOptions);

        // Registrar cada ruta del servicio
        for (const route of service.routes) {
            const methods = route.methods.map(m => m.toLowerCase());

            // Middleware opcional de autenticación (puedes reemplazarlo con tu lógica real)
            const authMiddleware = route.auth_required
                ? (req: any, res: any, next: any) => {
                      // Aquí normalmente verificarías un token JWT u otro esquema
                      console.log("Auth required – implement your logic here");
                      next(); // Por ahora, solo pasa al siguiente middleware
                  }
                : (req: any, res: any, next: any) => next();

            const fullPath = service.gateway_prefix + route.route;

            // Registrar cada método HTTP permitido
            for (const method of methods) {
                if (method === "get") {
                    router.get(fullPath, authMiddleware, proxy);
                } else if (method === "post") {
                    router.post(fullPath, authMiddleware, proxy);
                } else if (method === "put") {
                    router.put(fullPath, authMiddleware, proxy);
                } else if (method === "delete") {
                    router.delete(fullPath, authMiddleware, proxy);
                } else if (method === "patch") {
                    router.patch(fullPath, authMiddleware, proxy);
                } else if (method === "options") {
                    router.options(fullPath, authMiddleware, proxy);
                }
                // Agrega más métodos si es necesario (head, etc.)
            }
        }
    }

    return router;
}