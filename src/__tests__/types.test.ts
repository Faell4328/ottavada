import { describe, it, expect } from "vitest";
import type {
  SongListItem,
  ScoreListItem,
  Category,
  AppSettings,
  IndexedFile,
  SidebarView,
} from "../types";

describe("TypeScript Types", () => {
  describe("SongListItem", () => {
    it("should have required fields", () => {
      const song: SongListItem = {
        id: "s1",
        name: "Canon in D",
        composer: "Pachelbel",
        arranger: null,
        updated_at: "2024-01-01 12:00:00",
        is_favorite: false,
        category_ids: [],
        scores: [],
      };
      expect(song.id).toBe("s1");
      expect(song.name).toBe("Canon in D");
      expect(song.is_favorite).toBe(false);
      expect(song.scores).toEqual([]);
    });
  });

  describe("ScoreListItem", () => {
    it("should represent a score file", () => {
      const score: ScoreListItem = {
        id: "f1",
        name: "Violino 1",
        file_extension: "pdf",
        file_path: "/path/to/file.pdf",
        updated_at: "2024-01-01 12:00:00",
        status: "Main",
      };
      expect(score.name).toBe("Violino 1");
      expect(score.status).toBe("Main");
    });

    it("should support status values", () => {
      const scores: ScoreListItem[] = [
        { id: "1", name: "V1", file_extension: "pdf", file_path: "/v1.pdf", updated_at: "2024-01-01 12:00:00", status: "Main" },
        { id: "2", name: "V2", file_extension: "pdf", file_path: "/v2.pdf", updated_at: "2024-01-01 12:00:00", status: "Pending" },
        { id: "3", name: "V3", file_extension: "pdf", file_path: "/v3.pdf", updated_at: "2024-01-01 12:00:00", status: "Draft" },
      ];
      expect(scores[0].status).toBe("Main");
      expect(scores[1].status).toBe("Pending");
      expect(scores[2].status).toBe("Draft");
    });
  });

  describe("Category", () => {
    it("should have name and id", () => {
      const cat: Category = {
        id: "c1",
        name: "Harpa Cristã",
      };
      expect(cat.name).toBe("Harpa Cristã");
    });
  });

  describe("AppSettings", () => {
    it("should represent default settings", () => {
      const settings: AppSettings = {
        computer_id: "550e8400-e29b-41d4-a716-446655440000",
        computer_name: null,
        computer_type: "Server",
        google_drive_mode: "Local",
        first_run_completed: false,
        google_service_account: null,
      };
      expect(settings.google_drive_mode).toBe("Local");
    });

    it("should support Api mode", () => {
      const settings: AppSettings = {
        computer_id: "550e8400-e29b-41d4-a716-446655440000",
        computer_name: "Computador Teste",
        computer_type: "Server",
        google_drive_mode: "Api",
        first_run_completed: true,
        google_service_account: null,
      };
      expect(settings.google_drive_mode).toBe("Api");
    });
  });

  describe("IndexedFile", () => {
    it("should represent indexed file data", () => {
      const file: IndexedFile = {
        path: "/music/Canon - Violino.pdf",
        name: "Canon",
        instrument: "Violino",
        extension: "pdf",
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
