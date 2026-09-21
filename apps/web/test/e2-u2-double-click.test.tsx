import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobForm } from "../src/components/JobForm";

describe("E2-U2", () => {
  it("double click submit uses in-flight lock and the same idempotencyKey", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({ id: "j1" }), { status: 201 }));
          }, 50);
        }),
    );
    render(<JobForm projectId="01PROJECT" />);
    const btn = screen.getByRole("button", { name: "Crear job" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[1]?.body)) as { idempotencyKey: string };
    expect(payload.idempotencyKey.length).toBeGreaterThan(8);
    spy.mockRestore();
  });
});
