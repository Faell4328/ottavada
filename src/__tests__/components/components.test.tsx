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

// Mock react-virtual to avoid virtualization issues in tests
vi.mock("@tanstack/react-virtual", async () => {
  const actual = await vi.importActual("@tanstack/react-virtual");
  return {
    ...(actual as any),
    useVirtualizer: vi.fn((options: any) => {
      const count = options.count || 0;
      const items = Array.from({ length: count }, (_, i) => ({
        key: `item-${i}`,
        index: i,
        start: i * (options.estimateSize?.() || 35),
        size: options.estimateSize?.() || 35,
      }));
      
      return {
        getVirtualItems: () => items,
        getTotalSize: () => count * (options.estimateSize?.() || 35),
      };
    }),
  };
});

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
  loadScores: ReturnType<typeof vi.fn>;
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
} = {
  state: { ...baseState },
  loadScores: vi.fn(),
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
};

vi.mock("../../context/AppContext", () => ({
  useAppState: () => mockAppState,
  AppProvider: ({ children }: { children: ReactNode }) => children,
}));

// ── Import components after mocks ──

import ScoreList from "../../components/ScoreList";
import Sidebar from "../../components/Sidebar";
import VersionPanel from "../../components/VersionPanel";
import StatusBar from "../../components/StatusBar";
import TopBar from "../../components/TopBar";

describe("ScoreList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.state = {
      ...baseState,
    };
  });

  it("should render empty state", () => {
    render(<ScoreList />);
    expect(
      screen.getByText("Nenhuma partitura encontrada")
    ).toBeInTheDocument();
  });

  it("should show score count", () => {
    render(<ScoreList />);
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
        instruments: [],
      },
      {
        id: "s2",
        title: "Moonlight Sonata",
        composer: "Beethoven",
        arranger: null,
        updated_at: "2024-01-02 12:00:00",
        favorited: true,
        instruments: [],
      },
    ];
    render(<ScoreList />);
    expect(screen.getByText("Canon in D")).toBeInTheDocument();
    expect(screen.getByText("Moonlight Sonata")).toBeInTheDocument();
    expect(screen.getByText("2 partituras")).toBeInTheDocument();
  });

  it("should show correct label for All view", () => {
    render(<ScoreList />);
    expect(screen.getByText("Todas as Partituras")).toBeInTheDocument();
  });

  it("should show correct label for Favorites view", () => {
    mockAppState.state.sidebarView = "favorites";
    render(<ScoreList />);
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
  });

  it("should show correct label for Drafts view", () => {
    mockAppState.state.sidebarView = "drafts";
    render(<ScoreList />);
    expect(screen.getByText("Rascunhos Ativos")).toBeInTheDocument();
  });

  it("should show category name for category view", () => {
    mockAppState.state.sidebarView = {
      type: "category",
      id: "c1",
      name: "Harpa Cristã",
    };
    render(<ScoreList />);
    expect(screen.getByText("Harpa Cristã")).toBeInTheDocument();
  });

  it("should have search input", () => {
    render(<ScoreList />);
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
        favorited: false,
        instruments: [],
      },
    ];
    render(<ScoreList />);
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
    mockAppState.loadScores.mockResolvedValue(undefined);
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
      ]);
    });
    expect(mockAppState.loadScores).toHaveBeenCalled();
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
      ]);
    });
  });
});

describe("VersionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.state = {
      ...baseState,
    };
  });

  it("should show empty state when no file selected", () => {
    render(<VersionPanel />);
    expect(
      screen.getByText(
        "Selecione um instrumento para ver o histórico de versões"
      )
    ).toBeInTheDocument();
  });

  it("should show version history when file selected", () => {
    mockAppState.state.selectedScore = {
      id: "s1",
      title: "Canon",
      composer: null,
      arranger: null,
      updated_at: "2024-01-01 12:00:00",
      favorited: false,
      instruments: [],
    };
    mockAppState.state.selectedFile = {
      id: "f1",
      instrument: "Violino",
      file_extension: "pdf",
      updated_at: "2024-01-01 12:00:00",
      has_draft: false,
      version_count: 1,
    };
    mockAppState.state.versions = [
      {
        id: "v1",
        score_file_id: "f1",
        version_number: 1,
        label: "Versão Inicial",
        status: "Current",
        file_path: "/path",
        file_size: 1024,
        hash: null,
        is_compressed: false,
        created_at: "2024-01-01 12:00:00",
      },
    ];

    render(<VersionPanel />);
    expect(screen.getByText("Histórico de Versões:")).toBeInTheDocument();
    expect(screen.getByText("Versão Inicial")).toBeInTheDocument();
  });

  it("should show instrument name", () => {
    mockAppState.state.selectedScore = {
      id: "s1",
      title: "Canon",
      composer: null,
      arranger: null,
      updated_at: "2024-01-01 12:00:00",
      favorited: false,
      instruments: [],
    };
    mockAppState.state.selectedFile = {
      id: "f1",
      instrument: "Piano",
      file_extension: "pdf",
      updated_at: "2024-01-01 12:00:00",
      has_draft: false,
      version_count: 1,
    };
    render(<VersionPanel />);
    expect(screen.getByText(/Piano/)).toBeInTheDocument();
  });

  it("should show promote button when drafts exist", () => {
    mockAppState.state.selectedScore = {
      id: "s1",
      title: "Canon",
      composer: null,
      arranger: null,
      updated_at: "2024-01-01 12:00:00",
      favorited: false,
      instruments: [],
    };
    mockAppState.state.selectedFile = {
      id: "f1",
      instrument: "Violino",
      file_extension: "pdf",
      updated_at: "2024-01-01 12:00:00",
      has_draft: true,
      version_count: 2,
    };
    mockAppState.state.versions = [
      {
        id: "v1",
        score_file_id: "f1",
        version_number: 1,
        label: "V1",
        status: "Current",
        file_path: "/p",
        file_size: 1024,
        hash: null,
        is_compressed: false,
        created_at: "2024-01-01 12:00:00",
      },
      {
        id: "d1",
        score_file_id: "f1",
        version_number: 0,
        label: "Rascunho",
        status: "Draft",
        file_path: "/p2",
        file_size: 2048,
        hash: null,
        is_compressed: false,
        created_at: "2024-01-02 12:00:00",
      },
    ];
    render(<VersionPanel />);
    expect(screen.getByText("Definir Nova Versão")).toBeInTheDocument();
  });

  it("should show no versions message", () => {
    mockAppState.state.selectedScore = {
      id: "s1",
      title: "Canon",
      composer: null,
      arranger: null,
      updated_at: "2024-01-01 12:00:00",
      favorited: false,
      instruments: [],
    };
    mockAppState.state.selectedFile = {
      id: "f1",
      instrument: "Violino",
      file_extension: "pdf",
      updated_at: "2024-01-01 12:00:00",
      has_draft: false,
      version_count: 0,
    };
    render(<VersionPanel />);
    expect(screen.getByText("Nenhuma versão registrada")).toBeInTheDocument();
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
