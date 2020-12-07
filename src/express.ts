/* eslint-disable @typescript-eslint/no-misused-promises */
import fs from "fs/promises";
import express from "express";
import type { Express } from "express";
import marked from "marked";
import { getLogger } from "./util/logger";

const renderedMarkdownCache = new Map<string, string>();

const logger = getLogger({
    name: "slaurbot-express",
});

async function getHTMLFromMarkdownFile(path: string): Promise<string> {
    if (renderedMarkdownCache.has(path)) {
        logger.debug(`RENDER '${path}': returning from render cache`);
        return renderedMarkdownCache.get(path) as string;
    }
    try {
        logger.debug(`RENDER '${path}': reading file`);
        const markdownSource = String(await fs.readFile(path));
        const rendered = marked(markdownSource);
        renderedMarkdownCache.set(path, rendered);
        return rendered;
    }
    catch (e) {
        const msg = `Failed to render ${path}`;
        logger.debug(msg + String(e));
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
