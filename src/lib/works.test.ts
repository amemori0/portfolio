import { describe, expect, it } from "vitest";
import { sortWorks, statusLabel } from "./works";

describe("sortWorks", () => {
  it("order の小さい順に並べ、元の配列は変えない", () => {
    const input = [{ data: { order: 3 } }, { data: { order: 1 } }, { data: { order: 2 } }];
    const result = sortWorks(input);
    expect(result.map(work => work.data.order)).toEqual([1, 2, 3]);
    expect(input.map(work => work.data.order)).toEqual([3, 1, 2]);
  });
});

describe("statusLabel", () => {
  it("状態を日本語のラベルにする", () => {
    expect(statusLabel("published")).toBe("公開中");
    expect(statusLabel("in-progress")).toBe("制作中");
  });
});
