import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let seq = 0;
  const next = () => `id-${seq++}`;
  return {
    dismiss: vi.fn(),
    success: vi.fn(() => next()),
    error: vi.fn(() => next()),
    loading: vi.fn(() => next()),
    defaultToast: vi.fn(() => next()),
    nextId: next,
    resetSeq: () => {
      seq = 0;
    },
  };
});

vi.mock("react-hot-toast", () => ({
  default: Object.assign(mocks.defaultToast, {
    success: mocks.success,
    error: mocks.error,
    loading: mocks.loading,
    dismiss: mocks.dismiss,
    dismissAll: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    custom: vi.fn(() => mocks.nextId()),
    promise: vi.fn(),
  }),
}));

import toastModule from "../../utils/toast";

describe("toast limit", () => {
  let toast: typeof toastModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.resetSeq();
    vi.resetModules();
    toast = (await import("../../utils/toast")).default;
  });

  it("keeps up to ten toasts without dismissing", () => {
    for (let i = 0; i < 10; i++) toast.success("ok");

    expect(mocks.success).toHaveBeenCalledTimes(10);
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });

  it("dismisses the oldest toast when an eleventh is added", () => {
    for (let i = 0; i < 10; i++) toast.success("ok");
    toast.success("11th");

    expect(mocks.dismiss).toHaveBeenCalledWith("id-0");
  });

  it("dismisses the oldest toast for each extra toast", () => {
    for (let i = 0; i < 12; i++) toast.success("ok");

    expect(mocks.dismiss).toHaveBeenNthCalledWith(1, "id-0");
    expect(mocks.dismiss).toHaveBeenNthCalledWith(2, "id-1");
  });

  it("counts error and loading toasts towards the limit", () => {
    for (let i = 0; i < 10; i++) toast.error("e");
    toast.loading("l");

    expect(mocks.dismiss).toHaveBeenCalledWith("id-0");
  });

  it("counts plain toast calls towards the limit", () => {
    for (let i = 0; i < 10; i++) toast("plain");
    toast("extra");

    expect(mocks.dismiss).toHaveBeenCalledWith("id-0");
  });

  it("exposes dismiss for manual removal", () => {
    toast.success("a");
    toast.dismiss("id-0");

    expect(mocks.dismiss).toHaveBeenCalledWith("id-0");
  });
});
