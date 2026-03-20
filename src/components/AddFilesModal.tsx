import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useAppState } from "../context/AppContext";
import type { IndexedFile } from "../types";
import * as api from "../api/commands";
import { Modal, ModalFooterButtons, FormField, TextInput, ErrorMessage } from "./ui";
import { CategoryCheckboxList } from "./ui/CategoryCheckboxList";

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

  useEffect(() => {
    if (isOpen && files.length > 0) {
      setTitle(files[0].name || "");
      setComposer("");
      setArranger("");
      setSelectedCategories([]);
      setError("");
      setRemovedFileIndices(new Set());
      
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
    setInstrumentNames((prev) => ({ ...prev, [idx]: name }));
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
      const filteredFiles = activeFiles.map((f) => {
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

  if (files.length === 0) return null;

  const activeFiles = files.filter((_, idx) => !removedFileIndices.has(idx));
  const instrumentCount = activeFiles.length;

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
          onChange={setTitle}
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
            {files.map((file, idx) => {
              if (removedFileIndices.has(idx)) return null;
              
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#8b9db2] font-medium truncate">
                      {file.path.split('/').pop()}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 text-[#8b9db2] hover:text-red-500 transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <TextInput
                    value={instrumentNames[idx] || ""}
                    onChange={(val) => updateInstrumentName(idx, val)}
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
