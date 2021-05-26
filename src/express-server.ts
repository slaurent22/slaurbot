import dotenv from "dotenv";
import { createExpress } from "./express";
import { getLogger } from "./util/logger";

function main() {
    dotenv.config();
    const logger = getLogger({
        name: "express",
    });
    const port = process.env.PORT || 8080;
    const app = createExpress(logger);
    app.listen(port, () => console.log(`Express app listening on ${ port }`));
}

void main();
