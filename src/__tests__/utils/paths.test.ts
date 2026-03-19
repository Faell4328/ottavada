import { describe, it, expect } from "vitest";
import { getDirectoryPath } from "../../utils/paths";

describe("getDirectoryPath", () => {
  it("should extract directory from Unix path", () => {
    expect(getDirectoryPath("/home/user/music/score.pdf")).toBe("/home/user/music");
  });

  it("should extract directory from Windows path", () => {
    expect(getDirectoryPath("C:\\Users\\user\\music\\score.pdf")).toBe("C:/Users/user/music");
  });

  it("should handle mixed separators", () => {
    expect(getDirectoryPath("C:\\Users/music\\score.pdf")).toBe("C:/Users/music");
  });

  it("should return '.' for filename without directory", () => {
    expect(getDirectoryPath("score.pdf")).toBe(".");
  });

  it("should handle root path", () => {
    expect(getDirectoryPath("/score.pdf")).toBe(".");
  });

  it("should handle nested directories", () => {
    expect(getDirectoryPath("/a/b/c/d/e/file.txt")).toBe("/a/b/c/d/e");
  });

  it("should handle path with spaces", () => {
    expect(getDirectoryPath("/my music/partituras/file.musx")).toBe("/my music/partituras");
  });

  it("should handle path with special characters", () => {
    expect(getDirectoryPath("/música/hinos/arquivo.mus")).toBe("/música/hinos");
  });
});
