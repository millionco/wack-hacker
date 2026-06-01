import { describe, expect, it } from "vitest";

import { formatToolCall } from "./helpers.ts";

describe("formatToolCall", () => {
  it("renders dot notation for delegate tools", () => {
    const out = formatToolCall("github", "create_pr", {
      title: "Fix bug",
      branch: "fix/bug",
    });
    expect(out).toBe(`delegate_github.create_pr(\n    title="Fix bug",\n    branch="fix/bug",\n)`);
  });

  it("renders bare tool name when no delegate is set", () => {
    const out = formatToolCall(undefined, "send_message", { content: "hi" });
    expect(out).toBe(`send_message(\n    content="hi",\n)`);
  });

  it("omits parens body when input is empty", () => {
    expect(formatToolCall(undefined, "ping", {})).toBe("ping()");
  });

  it("strips _reason before rendering", () => {
    const out = formatToolCall(undefined, "x", { keep: 1, _reason: "because" });
    expect(out).toBe(`x(\n    keep=1,\n)`);
  });

  it("treats array inputs as empty-kwargs calls", () => {
    expect(formatToolCall(undefined, "x", [1, 2, 3])).toBe("x()");
  });

  it("truncates long string values with an ellipsis", () => {
    const long = "x".repeat(500);
    const out = formatToolCall(undefined, "t", { big: long });
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(300);
  });

  it("serializes nested objects as JSON", () => {
    const out = formatToolCall(undefined, "t", { opts: { a: 1, b: true } });
    expect(out).toContain(`opts={"a":1,"b":true}`);
  });

  it("renders undefined values as 'undefined' (not 'null')", () => {
    const out = formatToolCall(undefined, "t", { maybe: undefined });
    expect(out).toContain("maybe=undefined");
  });

  it("falls back to a placeholder when JSON.stringify throws (circular)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const out = formatToolCall(undefined, "t", { ref: circular });
    expect(out).toContain("ref=<unserializable>");
  });

  it("truncates long non-string values with a trailing ellipsis (no trailing quote)", () => {
    const longArray = Array.from({ length: 500 }, (_, i) => i);
    const out = formatToolCall(undefined, "t", { nums: longArray });
    expect(out).toContain("…");
    expect(out).not.toContain(`…"`);
  });
});
