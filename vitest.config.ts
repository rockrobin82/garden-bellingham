import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // The integration files share one local Postgres and hold a connection for
    // the whole file. Running them together makes connection checkout and row
    // locks exceed the 5s test timeout, and Vitest does not cancel the query
    // that timed out. A later test on that same client then stalls as well.
    // Each file still passes when it is the only database client, so the suite
    // runs files one at a time instead of raising the timeout.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
