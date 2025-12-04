import { Request, Response, NextFunction } from "express";
import signale from "signale";

const handlers = new Map<string, (req:Request, res:Response, next:NextFunction) => void>([
    ["test", (req, res, next) => {
        signale.info("handler successfully executed");
        next();
    }]
]);

export default handlers;