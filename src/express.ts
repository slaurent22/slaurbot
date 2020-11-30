/* eslint-disable @typescript-eslint/no-misused-promises */
import fs from "fs/promises";
import express from "express";
import type { Express } from "express";
import marked from "marked";
import { log, LogLevel } from "./logger";

async function getHTMLFromMarkdownFile(path: string): Promise<string> {
    try {
        const markdownSource = String(await fs.readFile(path));
        return marked(markdownSource);
    }
    catch (e) {
        const msg = `Failed to render ${path}`;
        log(LogLevel.DEBUG, msg, e);
        return msg;
    }
}

export function createExpress(): Express {
    return express()
        .get("/", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/index.md");
            res.send(result);
        })
        .get("/commands", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/commands.md");
            res.send(result);
        });
}
