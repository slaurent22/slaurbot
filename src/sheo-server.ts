import dotenv from "dotenv";
import { createSheo } from "./sheo";

async function main() {
    dotenv.config();
    console.log(process.env);
    await createSheo();
}

void main();
