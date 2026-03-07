import { describe, it, expect } from "vitest";
import type {
  ScoreListItem,
  ScoreFileItem,
  FileVersion,
  Category,
  AppSettings,
  IndexedFile,
  SidebarView,
} from "../types";

describe("TypeScript Types", () => {
  describe("ScoreListItem", () => {
    it("should have required fields", () => {
      const score: ScoreListItem = {
        id: "s1",
        title: "Canon in D",
        composer: "Pachelbel",
        arranger: null,
        updated_at: "2024-01-01 12:00:00",
        favorited: false,
        instruments: [],
      };
      expect(score.id).toBe("s1");
      expect(score.title).toBe("Canon in D");
      expect(score.favorited).toBe(false);
      expect(score.instruments).toEqual([]);
    });
  });

  describe("ScoreFileItem", () => {
    it("should represent a score file", () => {
      const file: ScoreFileItem = {
        id: "f1",
        instrument: "Violino 1",
        file_extension: "pdf",
        updated_at: "2024-01-01 12:00:00",
        has_draft: true,
        version_count: 3,
      };
      expect(file.instrument).toBe("Violino 1");
      expect(file.has_draft).toBe(true);
      expect(file.version_count).toBe(3);
    });

    it("should allow null instrument", () => {
      const file: ScoreFileItem = {
        id: "f2",
        instrument: null,
        file_extension: "mus",
        updated_at: "2024-01-01 12:00:00",
        has_draft: false,
        version_count: 1,
      };
      expect(file.instrument).toBeNull();
    });
  });

  describe("FileVersion", () => {
    it("should have valid status values", () => {
      const statuses: FileVersion["status"][] = [
        "Current",
        "Previous",
        "Draft",
        "Compressed",
      ];
      expect(statuses).toHaveLength(4);

      const version: FileVersion = {
        id: "v1",
        score_file_id: "f1",
        version_number: 1,
        label: "V1",
        status: "Current",
        file_path: "/path/to/file",
        file_size: 2048,
        hash: "abc123",
        is_compressed: false,
        created_at: "2024-01-01 12:00:00",
      };
      expect(version.status).toBe("Current");
      expect(version.is_compressed).toBe(false);
    });
  });

  describe("Category", () => {
    it("should have name and id", () => {
      const cat: Category = {
        id: "c1",
        name: "Harpa Cristã",
        created_at: "2024-01-01 12:00:00",
      };
      expect(cat.name).toBe("Harpa Cristã");
    });
  });

  describe("AppSettings", () => {
    it("should represent default settings", () => {
      const settings: AppSettings = {
        computer_name: null,
        logo_path: null,
        google_drive_mode: "Local",
        hash_enabled: false,
        first_run_completed: false,
        google_service_account: null,
      };
      expect(settings.hash_enabled).toBe(false);
      expect(settings.google_drive_mode).toBe("Local");
    });

    it("should support Api mode", () => {
      const settings: AppSettings = {
        computer_name: "Computador Teste",
        logo_path: null,
        google_drive_mode: "Api",
        hash_enabled: true,
        first_run_completed: true,
        google_service_account: null,
      };
      expect(settings.google_drive_mode).toBe("Api");
      expect(settings.hash_enabled).toBe(true);
    });
  });

  describe("IndexedFile", () => {
    it("should represent indexed file data", () => {
      const file: IndexedFile = {
        path: "/music/Canon - Violino.pdf",
        name: "Canon",
        instrument: "Violino",
        extension: "pdf",
        size: 1024,
      };
      expect(file.name).toBe("Canon");
      expect(file.instrument).toBe("Violino");
    });
  });

  describe("SidebarView", () => {
    it("should support string views", () => {
      const views: SidebarView[] = ["all", "favorites", "drafts"];
      expect(views).toContain("all");
      expect(views).toContain("favorites");
      expect(views).toContain("drafts");
    });

    it("should support category view", () => {
      const view: SidebarView = {
        type: "category",
        id: "c1",
        name: "Hinos",
      };
      expect(typeof view).toBe("object");
      if (typeof view === "object") {
        expect(view.type).toBe("category");
        expect(view.id).toBe("c1");
      }
    });
  });
});
