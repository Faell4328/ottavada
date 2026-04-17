import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextInput } from "../../components/ui/FormField";

function UppercaseInput() {
  const [value, setValue] = useState("HINO NACIONAL");

  return (
    <TextInput
      value={value}
      onChange={(nextValue) => setValue(nextValue.toUpperCase())}
      placeholder="Nome"
    />
  );
}

describe("TextInput", () => {
  it("keeps the caret position when the value is normalized during editing", () => {
    render(<UppercaseInput />);

    const input = screen.getByPlaceholderText("Nome");
    input.focus();
    input.setSelectionRange(5, 5);

    fireEvent.keyDown(input, { key: "x", code: "KeyX" });
    fireEvent.change(input, { target: { value: "HINO xNACIONAL" } });

    expect(input).toHaveValue("HINO XNACIONAL");
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
  });
});