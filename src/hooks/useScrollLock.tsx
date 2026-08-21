import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface ScrollLockContextValue {
  lock: () => void;
  unlock: () => void;
}

const NOOP_CONTEXT: ScrollLockContextValue = {
  lock: () => undefined,
  unlock: () => undefined,
};

const ScrollLockContext = createContext<ScrollLockContextValue>(NOOP_CONTEXT);

export function ScrollLockProvider({ children }: { children: ReactNode }) {
  const [lockCount, setLockCount] = useState(0);

  useEffect(() => {
    if (lockCount > 0) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [lockCount]);

  const lock = useCallback(() => setLockCount((count) => count + 1), []);
  const unlock = useCallback(
    () => setLockCount((count) => Math.max(0, count - 1)),
    [],
  );

  return (
    <ScrollLockContext.Provider value={{ lock, unlock }}>
      {children}
    </ScrollLockContext.Provider>
  );
}

export function useScrollLock(isActive: boolean) {
  const { lock, unlock } = useContext(ScrollLockContext);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    lock();

    return () => {
      unlock();
    };
  }, [isActive, lock, unlock]);
}
