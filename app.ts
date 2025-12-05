import express, { Request, Response } from "express";
import cors from "cors";
import signale from "signale";
import helmet from "helmet";
import dotenv from "dotenv";
import http from "http";
import { set_services } from "./src/routing/infrastructure/proxy_config.js";
dotenv.config();

const debug_console = true;

const app = express();

app.use(cors());
app.use(helmet());

if (debug_console) {
    app.use((req, res, next) => {
        signale.info(req.method + " - " + req.path + " - " + req.ip);
        next();
    });
}

// ✅ HEALTH CHECK DEL GATEWAY (CORREGIDO)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'OK',
        service: 'API Gateway',
        port: process.env.PORT || '4000',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        microservices: {
            auth_service: process.env.AUTH_SERVICE_HOST || 'not configured',
            ml_service: process.env.ML_SERVICE_HOST || 'not configured'
        }
    });
});

// Configurar rutas de servicios
app.use("", await set_services());

const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 4000;

server.listen(PORT, () => {
    signale.success(`api started successfully`);
    signale.star(`for testing, use http://localhost:${PORT}`);
});