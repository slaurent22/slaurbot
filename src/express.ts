/* eslint-disable @typescript-eslint/no-misused-promises */
import fs from "fs/promises";
import express from "express";
import type { Express } from "express";
import marked from "marked";
import { log, LogLevel } from "./logger";

const renderedMarkdownCache = new Map<string, string>();

async function getHTMLFromMarkdownFile(path: string): Promise<string> {
    if (renderedMarkdownCache.has(path)) {
        log(LogLevel.DEBUG, `RENDER '${path}': returning from render cache`);
        return renderedMarkdownCache.get(path) as string;
    }
    try {
        log(LogLevel.DEBUG, `RENDER '${path}': reading file`);
        const markdownSource = String(await fs.readFile(path));
        const rendered = marked(markdownSource);
        renderedMarkdownCache.set(path, rendered);
        return rendered;
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
