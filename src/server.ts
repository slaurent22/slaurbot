import sourceMapSupport from "source-map-support";
import { getLogger } from "./util/logger";
import { createExpress } from "./express";
import { createSheo } from "./sheo";

sourceMapSupport.install();

const PORT = process.env.PORT || 5000;

const logger = getLogger({
    name: "slaurbot-server",
});

function botServer() {
    const app = createExpress(getLogger({
        name: "slaurbot-express",
    }));
    app.listen(PORT, () => logger.info(`Express app listening on ${ PORT }`));
}

try {
    void createSheo();
}
catch (e) {
    console.error("sheo error", e);
}

try {
    void botServer();
}
catch (e) {
    console.error("bot error", e);
}
