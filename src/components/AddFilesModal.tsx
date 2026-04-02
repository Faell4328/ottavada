import { useState, useEffect } from "react";
import { ExternalLink, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";
import { getDirectoryPath, getFileName } from "../utils/paths";
import {
  normalizeScoreNameForSave,
  normalizeScoreNameInput,
  normalizeSongNameForSave,
  normalizeSongNameInput,
} from "../utils/nameFormat";
import { compareInstrumentNames } from "../utils/instrumentOrder";

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
  const [editingInstrumentIndex, setEditingInstrumentIndex] = useState<number | null>(null);
  const [openingScorePath, setOpeningScorePath] = useState<string | null>(null);
  const [openingLocationPath, setOpeningLocationPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && files.length > 0) {
      setTitle(normalizeSongNameInput(files[0].name || ""));
      setComposer("");
      setArranger("");
      setSelectedCategories([]);
      setError("");
      setRemovedFileIndices(new Set());
      setEditingInstrumentIndex(null);
      setOpeningScorePath(null);
      setOpeningLocationPath(null);
      
      const names: Record<number, string> = {};
      files.forEach((file, idx) => {
        names[idx] = normalizeScoreNameInput(file.instrument || "");
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
      [idx]: normalizeScoreNameInput(name),
    }));
  };

  const removeFile = (idx: number) => {
    setRemovedFileIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(idx);
      return newSet;
    });
  };

  const handleOpenScore = async (path: string) => {
    setOpeningScorePath(path);
    setError("");

    try {
      await api.openFilePath(path);
    } catch {
      setError("Não foi possível abrir a partitura selecionada");
    } finally {
      setOpeningScorePath(null);
    }
  };

  const handleOpenLocal = async (path: string) => {
    setOpeningLocationPath(path);
    setError("");

    try {
      await api.openFileLocation(path);
    } catch {
      setError("Não foi possível abrir o local da partitura selecionada");
    } finally {
      setOpeningLocationPath(null);
    }
  };

  const handleSave = async () => {
    const normalizedTitle = normalizeSongNameForSave(title);

    if (!normalizedTitle) {
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
      const filteredFiles = activeFiles.map((f) => {
        const originalIdx = files.indexOf(f);
        return {
          path: f.path,
          name: normalizedTitle,
          instrument: normalizeScoreNameForSave(
            instrumentNames[originalIdx] ?? f.instrument
          ),
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

  if (files.length === 0) return null;

  const activeFiles = files.filter((_, idx) => !removedFileIndices.has(idx));
  const instrumentCount = activeFiles.length;
  const visibleFiles = files
    .map((file, idx) => ({ file, idx }))
    .filter(({ idx }) => !removedFileIndices.has(idx))
    .sort((a, b) => {
      // Keep list stable while the user is actively typing in an input.
      // After blur, reorder based on edited instrument names.
      const useEditedNames = editingInstrumentIndex === null;
      const aName = useEditedNames
        ? instrumentNames[a.idx] ?? a.file.instrument
        : a.file.instrument;
      const bName = useEditedNames
        ? instrumentNames[b.idx] ?? b.file.instrument
        : b.file.instrument;
      return compareInstrumentNames(aName, bName);
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Partitura(s)"
      maxWidth="max-w-lg"
      footer={
        <ModalFooterButtons
          onCancel={onClose}
          onConfirm={handleSave}
          isSaving={isSaving}
        />
      }
    >
      <FormField label="Nome da Música" required>
        <TextInput
          value={title}
          onChange={(value) => setTitle(normalizeSongNameInput(value))}
          placeholder="Nome da música"
          autoFocus
        />
      </FormField>

      <FormField label="Compositor">
        <TextInput
          value={composer}
          onChange={setComposer}
          placeholder="Nome do compositor"
        />
      </FormField>

      <FormField label="Arranjador">
        <TextInput
          value={arranger}
          onChange={setArranger}
          placeholder="Nome do arranjador"
        />
      </FormField>

      {state.categories.length > 0 && (
        <FormField label="Categorias">
          <CategoryCheckboxList
            categories={state.categories}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </FormField>
      )}

      {instrumentCount > 0 && (
        <FormField label={`Instrumentos a adicionar (${instrumentCount})`}>
          <div className="rounded border border-[#c5cfdb] bg-white p-3 space-y-4 max-h-75 overflow-y-auto">
            {visibleFiles.map(({ file, idx }) => {
              const fileName = getFileName(file.path) || file.name;
              const directoryPath = getDirectoryPath(file.path);
              
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs text-[#5d738b] font-semibold break-all whitespace-normal">
                        {fileName}
                      </p>
                      <p className="text-[11px] text-[#8b9db2] break-all whitespace-normal mt-0.5">
                        {directoryPath}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenScore(file.path)}
                      disabled={openingScorePath === file.path || openingLocationPath === file.path}
                      className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Abrir partitura"
                    >
                      {openingScorePath === file.path ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      Abrir partitura
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLocal(file.path)}
                      disabled={openingScorePath === file.path || openingLocationPath === file.path}
                      className="inline-flex items-center gap-1 rounded border border-[#d8e0ea] px-2 py-1 text-[11px] text-[#5d738b] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Abrir local"
                    >
                      {openingLocationPath === file.path ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" />
                      )}
                      Abrir local
                    </button>
                  </div>
                  <TextInput
                    value={instrumentNames[idx] || ""}
                    onChange={(val) => updateInstrumentName(idx, val)}
                    onFocus={() => setEditingInstrumentIndex(idx)}
                    onBlur={() => setEditingInstrumentIndex(null)}
                    placeholder="Nome do instrumento"
                  />
                </div>
              );
            })}
          </div>
        </FormField>
      )}

      <ErrorMessage error={error} />
    </Modal>
  );
}
