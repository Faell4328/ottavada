import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UpdateModal } from "../../components/UpdateModal";

describe("UpdateModal", () => {
  it("renders only safe formatting tags from the release notes", () => {
    render(
      <UpdateModal
        isOpen
        isInstalling={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        update={{
          current_version: "1.0.0",
          version: "1.1.0",
          date: null,
          body: "<p>Texto <strong>importante</strong></p><ul><li>Item 1</li></ul><img src='x' /><script>alert(1)</script>",
        }}
      />
    );

    expect(screen.getByText("Texto")).toBeInTheDocument();
    expect(screen.getByText("importante")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.queryByText("alert(1)")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});