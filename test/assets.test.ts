import { describe, expect, it } from "vitest";
import { assetUrl, buildingAssetForFileKind, flattenAssetDefinitions, mapAssets } from "../src/webview/assets/mapAssets";

describe("map asset registry", () => {
  it("contains all required semantic asset groups", () => {
    expect(Object.keys(mapAssets.buildings).sort()).toEqual(["component", "controller", "entry", "generic", "index", "repository", "service", "test", "utility"]);
    expect(Object.keys(mapAssets.overlays).sort()).toEqual(["circularDependency", "created", "editPulse", "edited", "error", "readPulse", "selected"]);
    expect(flattenAssetDefinitions().length).toBe(24);
  });

  it("falls back specialized buildings to the generic asset definition", () => {
    expect(buildingAssetForFileKind("service")).toBe(mapAssets.buildings.service);
    expect(buildingAssetForFileKind("route")).toBe(mapAssets.buildings.controller);
    expect(buildingAssetForFileKind("other")).toBe(mapAssets.buildings.generic);
  });

  it("resolves mapped asset filenames without requiring missing optional files", () => {
    expect(assetUrl(mapAssets.backgrounds.world)).toBe("codebase-town-assets/grass03.png");
    expect(assetUrl(mapAssets.buildings.generic)).toBe("codebase-town-assets/Generic%20File%20Building.png");
    expect(assetUrl({ requiredForMvp: false, description: "missing optional test asset" })).toBeUndefined();
  });
});
