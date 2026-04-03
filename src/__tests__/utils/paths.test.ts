import { describe, it, expect } from "vitest";
import { getDirectoryPath, getFileName, isSamePath } from "../../utils/paths";

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

describe("getFileName", () => {
  it("should extract file name from Unix path", () => {
    expect(getFileName("/home/user/music/score.pdf")).toBe("score.pdf");
  });

  it("should extract file name from Windows path", () => {
    expect(getFileName("C:\\Users\\user\\music\\score.pdf")).toBe("score.pdf");
  });

  it("should return input when path has no directory", () => {
    expect(getFileName("score.pdf")).toBe("score.pdf");
  });

  it("should handle mixed separators", () => {
    expect(getFileName("C:\\Users/music\\score.pdf")).toBe("score.pdf");
  });
});

describe("isSamePath", () => {
  it("should match identical Unix paths", () => {
    expect(isSamePath("/home/user/music/score.pdf", "/home/user/music/score.pdf")).toBe(true);
  });

  it("should match Windows paths with different separators", () => {
    expect(isSamePath("C:\\Users\\user\\music\\score.pdf", "C:/Users/user/music/score.pdf")).toBe(
      true
    );
  });

  it("should match Windows paths with different drive letter casing", () => {
    expect(isSamePath("C:\\Users\\user\\music\\score.pdf", "c:/Users/user/music/score.pdf")).toBe(
      true
    );
  });

  it("should not match different files", () => {
    expect(isSamePath("C:\\Users\\user\\music\\score.pdf", "C:/Users/user/music/other.pdf")).toBe(
      false
    );
  });
});
