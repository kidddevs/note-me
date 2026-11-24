const test = require("node:test");
const assert = require("node:assert/strict");
const { bootSurfaceForSettings } = require("./.compiled/src/lib/appBoot.js");

test("first launch opens the welcome surface and keeps release notes pending", () => {
  assert.deepEqual(bootSurfaceForSettings(null, null, "0.2.1"), {
    surface: "welcome",
    releasePending: true,
  });
});

test("a new version opens release notes after the welcome screen was completed", () => {
  assert.deepEqual(bootSurfaceForSettings("0.2.0", "0.2.0", "0.2.1"), {
    surface: "release-notes",
    releasePending: true,
  });
});

test("a seen version boots directly into the workspace", () => {
  assert.deepEqual(bootSurfaceForSettings("0.2.1", "0.2.1", "0.2.1"), {
    surface: "ready",
    releasePending: false,
  });
});

test("a new release still shows notes when the welcome marker is older", () => {
  assert.deepEqual(bootSurfaceForSettings("0.2.0", "0.2.1", "0.2.2"), {
    surface: "release-notes",
    releasePending: true,
  });
});
