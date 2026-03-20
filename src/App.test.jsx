import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function createJsonResponse(payload) {
  return {
    ok: true,
    json: async () => payload,
  };
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(createJsonResponse({ message: "no auth" }))),
    );
  });

  it("인증되지 않은 경우 로그인 페이지를 보여준다", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "작사 워크스페이스" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    });
  });
});
