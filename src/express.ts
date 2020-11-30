import express from "express";
import type { Express } from "express";

export function createExpress(): Express {
    return express()
        .get("/", (req, res) => res.send("I am slaurbot"));
}
