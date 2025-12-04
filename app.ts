import express from "express";
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

app.use("", await set_services());

const server = http.createServer(app);

server.listen(process.env.PORT, () => {
    signale.success(`api started successfully`);
    signale.star(`for testing, use http://localhost:${process.env.PORT}`);
});