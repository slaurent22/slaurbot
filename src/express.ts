/* eslint-disable @typescript-eslint/no-misused-promises */
import fs from "fs/promises";
import path from "path";
import express from "express";
import type { Express } from "express";
import marked from "marked";
import { getLogger } from "./util/logger";

const renderedMarkdownCache = new Map<string, string>();

const logger = getLogger({
    name: "slaurbot-express",
});

async function getHTMLFromMarkdownFile(filePath: string): Promise<string> {
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

function redirectDistFile(app: Express, filename: string): Express {
    return app
        .get(`/${filename}`, (req, res) => {
            res.sendFile(path.join(__dirname, `/../src/hk-split-maker-dist/${filename}`));
        });
}

export function createExpress(): Express {
    const app = express()
        .get("/", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/index.md");
            res.send(result);
        })
        .get("/commands", async(req, res) => {
            const result = await getHTMLFromMarkdownFile("./src/web/commands.md");
            res.send(result);
        })
        .get("/hk-split-maker", (req, res) => {
            res.sendFile(path.join(__dirname, "/../src/hk-split-maker-dist/index.html"));
        });

    redirectDistFile(app, "890.bundle.js");
    redirectDistFile(app, "index.bundle.js");
    redirectDistFile(app, "index.bundle.js.LICENSE.txt");

    return app;
}
