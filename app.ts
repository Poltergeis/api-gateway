import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import signale from "signale";
import helmet from "helmet";
import dotenv from "dotenv";
import http from "http";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { set_services } from "./src/routing/infrastructure/proxy_config.js";
dotenv.config();

const debug_console = true;

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                  // Máximo 100 peticiones por IP
  message: 'Demasiadas peticiones, intenta más tarde'
});
app.use(limiter);  // O aplícalo solo a rutas sensibles como /auth

const MAX_BODY_SIZE = '10kb'; 

// 2. Usar express.json() para LIMITAR y CAPTURAR el buffer
app.use(express.json({
    limit: MAX_BODY_SIZE,
    verify: (req: Request, res: Response, buf: Buffer, encoding: string) => {
        // Almacenar el buffer original en el objeto request (req)
        (req as any).rawBody = buf; 
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: MAX_BODY_SIZE,
    verify: (req: Request, res: Response, buf: Buffer, encoding: string) => {
        (req as any).rawBody = buf;
    }
}));

app.use(cors());
app.use(helmet());

app.use(compression());

app.use((err:any, req:Request, res:Response, next:NextFunction) => {
  signale.error(err);
  res.status(500).json({ error: 'Error interno del servidor gateway' });
});

app.disable('x-powered-by');

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

app.post('/test-limit', (req: Request, res: Response) => {
    // Si llegamos aquí, express.json() no bloqueó la petición
    res.status(400).json({ 
        message: 'Error: El límite de tamaño falló. La petición no debió llegar aquí.' 
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