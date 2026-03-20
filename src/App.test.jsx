import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      vi.fn((url) => {
        const target = String(url);
        if (target.includes("/api/providers")) {
          return Promise.resolve(
            createJsonResponse({
              openai: true,
              gemini: false,
              openaiModel: "gpt-4o-mini",
              geminiModel: "gemini-1.5-flash",
            }),
          );
        }
        if (target.includes("/api/templates")) {
          return Promise.resolve(createJsonResponse({ items: [] }));
        }
        if (target.includes("/api/audio/folders")) {
          return Promise.resolve(createJsonResponse({ folders: ["default"] }));
        }
        if (target.includes("/api/audio/files")) {
          return Promise.resolve(createJsonResponse({ items: [] }));
        }
        return Promise.resolve(createJsonResponse({}));
      }),
    );
  });

  it("탭 UI를 렌더링하고 탭 전환이 된다", async () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "작업공간" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오디오 드라이브" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오디오 드라이브" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "오디오 드라이브" })).toBeInTheDocument();
      expect(screen.getByText("파일이 없습니다.")).toBeInTheDocument();
    });
  });
});
