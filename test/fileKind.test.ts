import { describe, expect, it } from "vitest";
import { inferFileKind } from "../src/analysis/fileKind";

describe("inferFileKind", () => {
  it("classifies common file roles deterministically", () => {
    expect(inferFileKind("src/main.ts", false)).toBe("entry");
    expect(inferFileKind("src/auth/auth.controller.ts", false)).toBe("controller");
    expect(inferFileKind("src/auth/auth.service.ts", false)).toBe("service");
    expect(inferFileKind("src/auth/auth.service.spec.ts", false)).toBe("test");
    expect(inferFileKind("src/auth/index.ts", false)).toBe("index");
    expect(inferFileKind("src/users/user.component.tsx", true)).toBe("component");
    expect(inferFileKind("src/users/user.repository.ts", false)).toBe("repository");
    expect(inferFileKind("src/users/user.utils.ts", false)).toBe("utility");
  });

  it("prefers generic fallback over uncertain classifications", () => {
    expect(inferFileKind("src/domain/profile.ts", false)).toBe("other");
  });

  it("uses exported symbols when a service-like class is present", () => {
    expect(inferFileKind("src/domain/user.ts", false, [{ name: "UserService", kind: "class", isDefault: false }])).toBe("service");
  });
});
