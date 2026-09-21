import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobForm } from "../src/components/JobForm";

describe("E2-U1", () => {
  it("does not fetch on JobForm mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    render(<JobForm projectId="01PROJECT" />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
