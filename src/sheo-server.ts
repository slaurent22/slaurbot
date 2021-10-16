import dotenv from "dotenv";
import { createSheo } from "./sheo";

async function main() {
    dotenv.config();
    await createSheo();
}
try {
    void main();
}
catch (e) {
    console.error("sheo error", e);
}
