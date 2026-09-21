import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/pages/HomePage";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("E2-S1", () => {
  it("renders Sin proyectos when the list is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ projects: [] }), { status: 200 }),
    );
    render(wrap(<HomePage />));
    expect(await screen.findByText("Sin proyectos")).toBeTruthy();
  });

  it("renders a fixture title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ projects: [{ id: "p1", title: "Night library", channel: "demo" }] }), {
        status: 200,
      }),
    );
    render(wrap(<HomePage />));
    await waitFor(() => expect(screen.getByText("Night library")).toBeTruthy());
  });
});
