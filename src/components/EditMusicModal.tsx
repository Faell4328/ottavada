import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { SongListItem } from "../types";

interface EditMusicModalProps {
  isOpen: boolean;
  score: SongListItem | null;
  onClose: () => void;
  onSave: (data: {
    songId: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
}

export function EditMusicModal({
  isOpen,
  score,
  onClose,
  onSave,
}: EditMusicModalProps) {
  const { state } = useAppState();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize form with score data when modal opens
  useEffect(() => {
    if (isOpen && score) {
      setTitle(score.name || "");
      setComposer(score.composer || "");
      setArranger(score.arranger || "");
      setSelectedCategories(score.category_ids || []);
      setError("");
    }
  }, [isOpen, score]); // Não incluir state.categories: causaria reset dos checkboxes ao criar nova categoria

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!score || !title.trim()) {
      setError("O título é obrigatório");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        songId: score.id,
        title: title.trim(),
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
        categoryIds: selectedCategories,
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !score) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e0e8f0]">
          <h2 className="text-lg font-bold text-[#2f4259]">Editar Música</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f2f5fa] transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5 text-[#8b9db2]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
              placeholder="Nome da música"
              disabled={isSaving}
            />
          </div>

          {/* Composer */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Compositor
            </label>
            <input
              type="text"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
              placeholder="Nome do compositor"
              disabled={isSaving}
            />
          </div>

          {/* Arranger */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Arranjador
            </label>
            <input
              type="text"
              value={arranger}
              onChange={(e) => setArranger(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
              placeholder="Nome do arranjador"
              disabled={isSaving}
            />
          </div>

          {/* Categories - Multiple Selection */}
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-2">
              Categorias (múltiplas seleções)
            </label>
            <div className="space-y-2">
              {state.categories.length === 0 ? (
                <p className="text-xs text-[#8b9db2]">
                  Nenhuma categoria criada ainda
                </p>
              ) : (
                <div className="space-y-2 border border-[#c5cfdb] rounded p-3 max-h-40 overflow-y-auto">
                  {state.categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        disabled={isSaving}
                        className="rounded border-[#c5cfdb]"
                      />
                      <span className="text-sm text-[#344b61]">
                        {category.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded bg-red-50 border border-red-200 p-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[#e0e8f0]">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-[#c5cfdb] px-3 py-2 text-sm font-medium text-[#344b61] hover:bg-[#f2f5fa] transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded bg-[#5c9ae6] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a84c7] transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
