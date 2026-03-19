import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile } from "../types";
import * as api from "../api/commands";

interface AddFilesModalProps {
  isOpen: boolean;
  files: IndexedFile[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function AddFilesModal({
  isOpen,
  files,
  onClose,
  onSuccess,
}: AddFilesModalProps) {
  const { state } = useAppState();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [instrumentNames, setInstrumentNames] = useState<Record<number, string>>({});
  const [removedFileIndices, setRemovedFileIndices] = useState<Set<number>>(new Set());

  // Extrair nome base da música do primeiro arquivo
  useEffect(() => {
    if (isOpen && files.length > 0) {
      setTitle(files[0].name || "");
      setComposer("");
      setArranger("");
      setSelectedCategories([]);
      setError("");
      setRemovedFileIndices(new Set());
      
      // Inicializar nomes dos instrumentos
      const names: Record<number, string> = {};
      files.forEach((file, idx) => {
        names[idx] = file.instrument || "";
      });
      setInstrumentNames(names);
    }
  }, [isOpen, files]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const updateInstrumentName = (idx: number, name: string) => {
    setInstrumentNames((prev) => ({
      ...prev,
      [idx]: name,
    }));
  };

  const removeFile = (idx: number) => {
    setRemovedFileIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(idx);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("O título da música é obrigatório");
      return;
    }

    const activeFiles = files.filter((_, idx) => !removedFileIndices.has(idx));
    
    if (activeFiles.length === 0) {
      setError("Adicione pelo menos um arquivo");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      // Mapear arquivos ativos com nomes de instrumentos editados
      const filteredFiles = activeFiles.map((f, idx) => {
        // Encontrar o índice original do arquivo
        const originalIdx = files.indexOf(f);
        return {
          path: f.path,
          name: title.trim(),
          instrument: instrumentNames[originalIdx] || f.instrument,
          extension: f.extension,
        };
      });

      await api.importIndexedFilesWithMetadata(
        filteredFiles,
        selectedCategories,
        composer.trim() || null,
        arranger.trim() || null
      );

      await onSuccess();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || files.length === 0) return null;

  const activeFiles = files.filter((_, idx) => !removedFileIndices.has(idx));
  const instrumentCount = activeFiles.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-[#1e2836] p-6 shadow-xl border border-white/15 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Adicionar Partitura(s)</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nome da Música */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Nome da Música *
            </label>
            <input
              type="text"
              placeholder="Nome da música"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/10 transition-colors"
              autoFocus
            />
          </div>

          {/* Compositor */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Compositor
            </label>
            <input
              type="text"
              placeholder="Nome do compositor"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/10 transition-colors"
            />
          </div>

          {/* Arranjador */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Arranjador
            </label>
            <input
              type="text"
              placeholder="Nome do arranjador"
              value={arranger}
              onChange={(e) => setArranger(e.target.value)}
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/10 transition-colors"
            />
          </div>

          {/* Categorias */}
          {state.categories && state.categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Categorias
              </label>
              <div className="space-y-2">
                {state.categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="rounded border border-white/20 bg-white/5 w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <span className="text-sm text-white/90">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Instrumentos a adicionar */}
          {instrumentCount > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Instrumentos a adicionar ({instrumentCount})
              </label>
              <div className="rounded border border-white/20 bg-white/5 p-3 space-y-4 max-h-75 overflow-y-auto">
                {files.map((file, idx) => {
                  if (removedFileIndices.has(idx)) return null;
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/60 font-medium truncate">
                          {file.path.split('/').pop()}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 text-white/60 hover:text-red-400 transition-colors"
                          title="Remover arquivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={instrumentNames[idx] || ""}
                        onChange={(e) => updateInstrumentName(idx, e.target.value)}
                        placeholder="Nome do instrumento"
                        className="w-full rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/10 transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded border border-white/20 px-4 py-2 text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
