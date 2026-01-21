"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const handler_1 = require("../src/handler");
(0, vitest_1.describe)("handler", () => {
    (0, vitest_1.it)("returns OK", async () => {
        const res = await (0, handler_1.handler)();
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.body).toBe("OK");
    });
});
