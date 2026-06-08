import { useEffect } from "react";

let lockCount = 0;

export function useScrollLock(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    lockCount++;
    document.body.style.overflow = "hidden";

    return () => {
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = "";
      }
    };
  }, [isActive]);
}
