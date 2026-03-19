import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useAppState } from "../context/AppContext";

interface AddMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    composer: string | null;
    arranger: string | null;
    categoryIds: string[];
  }) => Promise<void>;
}

export function AddMusicModal({
  isOpen,
  onClose,
  onSave,
}: AddMusicModalProps) {
  const { state } = useAppState();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setComposer("");
      setArranger("");
      setSelectedCategories([]);
      setError("");
    }
  }, [isOpen]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Digite o título da música");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        title: title.trim(),
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
        categoryIds: selectedCategories,
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao criar música";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-[#f8fafd] shadow-xl border border-[#c5cfdb] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#d8e0ea]">
          <h2 className="text-lg font-bold text-[#2f4259]">Adicionar Música</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#eef2f6] transition-colors"
          >
            <X className="h-5 w-5 text-[#8b9db2]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Nome da Música *
            </label>
            <input
              type="text"
              placeholder="Nome da música"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              className="w-full rounded border border-[#c5cfdb] bg-white px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Compositor
            </label>
            <input
              type="text"
              placeholder="Nome do compositor"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] bg-white px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#344b61] mb-1.5">
              Arranjador
            </label>
            <input
              type="text"
              placeholder="Nome do arranjador"
              value={arranger}
              onChange={(e) => setArranger(e.target.value)}
              className="w-full rounded border border-[#c5cfdb] bg-white px-3 py-2 text-sm text-[#344b61] placeholder-[#a3b5c7] outline-none focus:border-[#7ba0d4] focus:ring-1 focus:ring-[#7ba0d4]/30"
            />
          </div>

          {/* Categorias */}
          {state.categories && state.categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#344b61] mb-2">
                Categorias
              </label>
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
                      className="rounded border-[#c5cfdb]"
                    />
                    <span className="text-sm text-[#344b61]">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded bg-red-50 border border-red-200 p-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[#d8e0ea]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded border border-[#c5cfdb] px-3 py-2 text-sm font-medium text-[#344b61] hover:bg-[#eef2f6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded bg-[#4f84d7] px-3 py-2 text-sm font-medium text-white hover:bg-[#3d6fb8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Criando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
