import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextInput } from "../../components/ui/FormField";

function UppercaseInput({ initial = "HINO NACIONAL" }: { initial?: string } = {}) {
  const [value, setValue] = useState(initial);

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

    const input = screen.getByPlaceholderText("Nome") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(5, 5);

    fireEvent.keyDown(input, { key: "x", code: "KeyX" });
    fireEvent.change(input, { target: { value: "HINO xNACIONAL" } });

    expect(input).toHaveValue("HINO XNACIONAL");
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
  });

  it("moves the caret correctly for backspace and keeps delete in place", () => {
    render(<UppercaseInput initial="ABCDE" />);

    const input = screen.getByPlaceholderText("Nome") as HTMLInputElement;
    input.focus();

    input.setSelectionRange(2, 2);
    fireEvent.keyDown(input, { key: "Backspace", code: "Backspace" });
    fireEvent.change(input, { target: { value: "ACDE" } });

    expect(input).toHaveValue("ACDE");
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);

    render(<UppercaseInput initial="ABCDE" />);

    const deleteInput = screen.getAllByPlaceholderText("Nome")[1] as HTMLInputElement;
    deleteInput.focus();

    deleteInput.setSelectionRange(2, 2);
    fireEvent.keyDown(deleteInput, { key: "Delete", code: "Delete" });
    fireEvent.change(deleteInput, { target: { value: "ABDE" } });

    expect(deleteInput).toHaveValue("ABDE");
    expect(deleteInput.selectionStart).toBe(2);
    expect(deleteInput.selectionEnd).toBe(2);
  });
});