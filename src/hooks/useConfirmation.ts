import { useState, useCallback } from "react";

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
  isLoading: boolean;
}

const initialState: ConfirmationState = {
  isOpen: false,
  title: "",
  message: "",
  action: null,
  isLoading: false,
};

export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>(initialState);

  const requestConfirmation = useCallback(
    (title: string, message: string, action: () => Promise<void>) => {
      setState({ isOpen: true, title, message, action, isLoading: false });
    },
    []
  );

  const confirm = useCallback(async () => {
    if (!state.action) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await state.action();
    } finally {
      setState(initialState);
    }
  }, [state.action]);

  const cancel = useCallback(() => {
    if (!state.isLoading) {
      setState(initialState);
    }
  }, [state.isLoading]);

  return {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    isLoading: state.isLoading,
    requestConfirmation,
    confirm,
    cancel,
  };
}
