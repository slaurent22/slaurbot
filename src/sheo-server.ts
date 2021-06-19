import dotenv from "dotenv";
import { createSheo } from "./sheo";

async function main() {
    dotenv.config();
    await createSheo();
}

void main();
