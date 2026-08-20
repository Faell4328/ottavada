import toast from "react-hot-toast";

const MAX_TOASTS = 10;
const activeToasts: string[] = [];

type ToastApi = typeof toast;
type ToastOptions = Parameters<typeof toast>[1];

function track(id: string): void {
  if (activeToasts.length >= MAX_TOASTS) {
    const oldest = activeToasts.shift();
    if (oldest) toast.dismiss(oldest);
  }
  activeToasts.push(id);
}

function passThrough<K extends keyof ToastApi>(key: K): ToastApi[K] {
  const method = toast[key];
  return (typeof method === "function" ? method.bind(toast) : method) as ToastApi[K];
}

function limited(method: (message: Parameters<typeof toast>[0], options?: ToastOptions) => string, message: Parameters<typeof toast>[0], options?: ToastOptions): string {
  const id = method(message, options);
  track(id);
  return id;
}

const limitedToast: ToastApi = Object.assign(
  function limitedToast(message: Parameters<typeof toast>[0], options?: ToastOptions): string {
    return limited(toast, message, options);
  },
  {
    success: (message: Parameters<typeof toast>[0], options?: ToastOptions) =>
      limited(toast.success, message, options),
    error: (message: Parameters<typeof toast>[0], options?: ToastOptions) =>
      limited(toast.error, message, options),
    loading: (message: Parameters<typeof toast>[0], options?: ToastOptions) =>
      limited(toast.loading, message, options),
    custom: (message: Parameters<typeof toast>[0], options?: ToastOptions) =>
      limited(toast.custom, message, options),
    dismiss: passThrough("dismiss"),
    dismissAll: passThrough("dismissAll"),
    remove: passThrough("remove"),
    removeAll: passThrough("removeAll"),
    promise: passThrough("promise"),
  }
);

export default limitedToast;
