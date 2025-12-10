import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import signale from "signale";
import helmet from "helmet";
import dotenv from "dotenv";
import http from "http";
import { set_services } from "./routing/infrastructure/proxy_config.js";

dotenv.config();

const debug_console = true;

async function bootstrap() {
  const app = express();

  app.use(cors());
  app.use(helmet());

  if (debug_console) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      signale.info(`${req.method} - ${req.path} - ${req.ip}`);
      next();
    });
  }

  app.use("", await set_services());

  const server = http.createServer(app);

  const PORT = Number(process.env.PORT) || 4000;

  server.listen(PORT, () => {
    signale.success(`API Gateway started successfully`);
    signale.star(`For testing, use http://localhost:${PORT}`);
  });
}

// Ejecuta la función principal
bootstrap();
