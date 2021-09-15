import fs from "fs/promises";
import express from "express";
import type { Express } from "express";
import marked from "marked";
import type { Logger } from "@d-fischer/logger";

const renderedMarkdownCache = new Map<string, string>();

async function getHTMLFromMarkdownFile(filePath: string, logger: Logger): Promise<string> {
    if (renderedMarkdownCache.has(filePath)) {
        logger.debug(`RENDER '${filePath}': returning from render cache`);
        return renderedMarkdownCache.get(filePath) as string;
    }
    try {
        logger.debug(`RENDER '${filePath}': reading file`);
        const markdownSource = String(await fs.readFile(filePath));
        const rendered = marked(markdownSource);
        renderedMarkdownCache.set(filePath, rendered);
        return rendered;
    }
    catch (e) {
        const msg = `Failed to render ${filePath}`;
        logger.debug(msg + String(e));
        return msg;
    }
}

export function createExpress(logger: Logger): Express {
    const app = express()
        .get("/", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/index.md", logger);
            res.send(result);
        })
        .get("/commands", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/commands.md", logger);
            res.send(result);
        })
        .get(/^\/hk-split-maker*/, (req, res) => {
            res.redirect(301, "https://hksplitmaker.com/");
        });

    return app;
}
