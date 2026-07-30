import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../src/analysis/discoverFiles";

const fixtureRoot = path.resolve("test/fixtures/basic");

describe("discoverSourceFiles", () => {
  it("finds supported JS and TS files while excluding generated folders", async () => {
    const files = await discoverSourceFiles(fixtureRoot);
    const relative = files.map((file) => path.relative(fixtureRoot, file).replace(/\\/g, "/"));

    expect(relative).toContain("src/auth/auth.service.ts");
    expect(relative).toContain("src/dynamic.ts");
    expect(relative).not.toContain("node_modules/ignored.ts");
  });

  it("applies caller exclusions", async () => {
    const files = await discoverSourceFiles(fixtureRoot, { exclude: ["src/cycle"] });
    const relative = files.map((file) => path.relative(fixtureRoot, file).replace(/\\/g, "/"));
    expect(relative.some((file) => file.startsWith("src/cycle"))).toBe(false);
  });
});
