import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
    optimizeDeps: {
        include: ["bpmn-js-create-append-anything"],
    },
    test: {
        include: ["test/**/*.spec.ts"],
        browser: {
            enabled: false,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright(),
        },
    },
});
