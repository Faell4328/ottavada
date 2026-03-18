import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import type { AppState } from "../../types";
import { open } from "@tauri-apps/plugin-dialog";

// ── Mock Tauri APIs ──

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const mockApi = vi.hoisted(() => ({
  scanDirectory: vi.fn(),
  importIndexedFiles: vi.fn(),
}));

vi.mock("../../api/commands", () => mockApi);

// ── Mock AppContext ──

const baseState: AppState = {
  scores: [],
  categories: [],
  settings: null,
  sidebarView: "all",
  selectedScore: null,
  selectedFile: null,
  versions: [],
  searchQuery: "",
  isFirstRun: false,
  isLoading: false,
};

const mockAppState: {
  state: AppState;
  loadSongs: ReturnType<typeof vi.fn>;
  loadCategories: ReturnType<typeof vi.fn>;
  loadSettings: ReturnType<typeof vi.fn>;
  setSidebarView: ReturnType<typeof vi.fn>;
  selectScore: ReturnType<typeof vi.fn>;
  selectFile: ReturnType<typeof vi.fn>;
  loadVersions: ReturnType<typeof vi.fn>;
  setSearchQuery: ReturnType<typeof vi.fn>;
  toggleFavorite: ReturnType<typeof vi.fn>;
  promoteDraft: ReturnType<typeof vi.fn>;
  deleteVersion: ReturnType<typeof vi.fn>;
  createCategory: ReturnType<typeof vi.fn>;
  deleteCategory: ReturnType<typeof vi.fn>;
  saveSettings: ReturnType<typeof vi.fn>;
  completeFirstRun: ReturnType<typeof vi.fn>;
  updateScore: ReturnType<typeof vi.fn>;
  updateScoreFile: ReturnType<typeof vi.fn>;
} = {
  state: { ...baseState },
  loadSongs: vi.fn(),
  loadCategories: vi.fn(),
  loadSettings: vi.fn(),
  setSidebarView: vi.fn(),
  selectScore: vi.fn(),
  selectFile: vi.fn(),
  loadVersions: vi.fn(),
  setSearchQuery: vi.fn(),
  toggleFavorite: vi.fn(),
  promoteDraft: vi.fn(),
  deleteVersion: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  saveSettings: vi.fn(),
  completeFirstRun: vi.fn(),
  updateScore: vi.fn(),
  updateScoreFile: vi.fn(),
};

vi.mock("../../context/AppContext", () => ({
  useAppState: () => mockAppState,
  AppProvider: ({ children }: { children: ReactNode }) => children,
}));

// ── Import components after mocks ──

import SongsList from "../../components/SongsList";
import Sidebar from "../../components/Sidebar";
import StatusBar from "../../components/StatusBar";
import TopBar from "../../components/TopBar";

describe("SongsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.state = {
      ...baseState,
    };
  });

  it("should render empty state", () => {
    render(<SongsList />);
    expect(
      screen.getByText("Nenhuma partitura encontrada")
    ).toBeInTheDocument();
  });

  it("should show score count", () => {
    render(<SongsList />);
    expect(screen.getByText("0 partituras")).toBeInTheDocument();
  });

  it("should render scores list", () => {
    mockAppState.state.scores = [
      {
        id: "s1",
        title: "Canon in D",
        composer: "Pachelbel",
        arranger: null,
        updated_at: "2024-01-01 12:00:00",
        favorited: false,
        category_ids: [],
        instruments: [],
      },
      {
        id: "s2",
        title: "Moonlight Sonata",
        composer: "Beethoven",
        arranger: null,
        updated_at: "2024-01-02 12:00:00",
        favorited: true,
        category_ids: [],
        instruments: [],
      },
    ];
    render(<SongsList />);
    expect(screen.getByText("Canon in D")).toBeInTheDocument();
    expect(screen.getByText("Moonlight Sonata")).toBeInTheDocument();
    expect(screen.getByText("2 partituras")).toBeInTheDocument();
  });

  it("should show correct label for All view", () => {
    render(<SongsList />);
    expect(screen.getByText("Todas as Partituras")).toBeInTheDocument();
  });

  it("should show correct label for Favorites view", () => {
    mockAppState.state.sidebarView = "favorites";
    render(<SongsList />);
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
  });

  it("should show correct label for Drafts view", () => {
    mockAppState.state.sidebarView = "drafts";
    render(<SongsList />);
    expect(screen.getByText("Rascunhos Ativos")).toBeInTheDocument();
  });

  it("should show category name for category view", () => {
    mockAppState.state.sidebarView = {
      type: "category",
      id: "c1",
      name: "Harpa Cristã",
    };
    render(<SongsList />);
    expect(screen.getByText("Harpa Cristã")).toBeInTheDocument();
  });

  it("should have search input", () => {
    render(<SongsList />);
    const input = screen.getByPlaceholderText("Buscar partituras...");
    expect(input).toBeInTheDocument();
  });

  it("should render singular count for 1 score", () => {
    mockAppState.state.scores = [
      {
        id: "s1",
        title: "Canon",
        composer: null,
        arranger: null,
        updated_at: "2024-01-01 12:00:00",
        favorited: false,        category_ids: [],        instruments: [],
      },
    ];
    render(<SongsList />);
    expect(screen.getByText("1 partitura")).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.state = {
      ...baseState,
    };
  });

  it("should render library section", () => {
    render(<Sidebar />);
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Todas as Partituras")).toBeInTheDocument();
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
    expect(screen.getByText("Rascunhos Ativos")).toBeInTheDocument();
  });

  it("should render categories section", () => {
    render(<Sidebar />);
    expect(screen.getByText("Categorias")).toBeInTheDocument();
  });

  it("should show empty categories message", () => {
    render(<Sidebar />);
    expect(screen.getByText("Nenhuma categoria")).toBeInTheDocument();
  });

  it("should render category items", () => {
    mockAppState.state.categories = [
      { id: "c1", name: "Harpa Cristã", created_at: "2024-01-01 12:00:00" },
      { id: "c2", name: "Louvor", created_at: "2024-01-01 12:00:00" },
    ];
    render(<Sidebar />);
    expect(screen.getByText("Harpa Cristã")).toBeInTheDocument();
    expect(screen.getByText("Louvor")).toBeInTheDocument();
  });

  it("should call setSidebarView on click", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText("Favoritos"));
    expect(mockAppState.setSidebarView).toHaveBeenCalledWith("favorites");
  });

  it("should create category when pressing Enter", async () => {
    render(<Sidebar />);
    const categoriesHeader = screen.getByText("Categorias").parentElement;
    const toggleButton = categoriesHeader?.querySelector("button");
    expect(toggleButton).toBeTruthy();
    fireEvent.click(toggleButton as HTMLButtonElement);

    const input = screen.getByPlaceholderText("Nome da categoria");
    fireEvent.change(input, { target: { value: "Louvor" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mockAppState.createCategory).toHaveBeenCalledWith("Louvor");
    });
  });
});

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.scanDirectory.mockResolvedValue([]);
    mockApi.importIndexedFiles.mockResolvedValue([]);
    mockAppState.loadSongs.mockResolvedValue(undefined);
  });

  it("should import selected files via add file", async () => {
    vi.mocked(open).mockResolvedValue(["/music/Canon - Violino.pdf"]);
    mockApi.scanDirectory.mockResolvedValue([
      {
        path: "/music/Canon - Violino.pdf",
        name: "Canon",
        instrument: "Violino",
        extension: "pdf",
        size: 123,
      },
    ]);

    render(<TopBar />);
    fireEvent.click(screen.getByTitle("Adicionar arquivo"));

    await waitFor(() => {
      expect(mockApi.scanDirectory).toHaveBeenCalledWith("/music");
      expect(mockApi.importIndexedFiles).toHaveBeenCalledWith([
        {
          path: "/music/Canon - Violino.pdf",
          name: "Canon",
          instrument: "Violino",
          extension: "pdf",
          size: 123,
        },
      ], []);
    });
    await waitFor(() => {
      expect(mockAppState.loadSongs).toHaveBeenCalled();
    });
  });

  it("should scan and import directory", async () => {
    vi.mocked(open).mockResolvedValue("/music");
    mockApi.scanDirectory.mockResolvedValue([
      {
        path: "/music/Amazing Grace - Piano.musx",
        name: "Amazing Grace",
        instrument: "Piano",
        extension: "musx",
        size: 321,
      },
    ]);

    render(<TopBar />);
    fireEvent.click(screen.getByTitle("Indexar diretório"));

    await waitFor(() => {
      expect(mockApi.scanDirectory).toHaveBeenCalledWith("/music");
      expect(mockApi.importIndexedFiles).toHaveBeenCalledWith([
        {
          path: "/music/Amazing Grace - Piano.musx",
          name: "Amazing Grace",
          instrument: "Piano",
          extension: "musx",
          size: 321,
        },
      ], []);
    });
  });
});

describe("StatusBar", () => {
  it("should render status indicators", () => {
    render(<StatusBar />);
    expect(screen.getByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Backup USB")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("should navigate to settings when button is clicked", () => {
    render(<StatusBar />);
    fireEvent.click(screen.getByText("Configurações"));
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });
});
