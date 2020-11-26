import express from "express";
import {log, LogLevel } from "./logger";

export default function webServer(): void {
    const PORT = process.env.PORT || 5000;
    express()
        .get("/", (req, res) => res.send("I am slaurbot"))
        .listen(PORT, () => log(LogLevel.INFO, `Listening on ${ PORT }`));
}