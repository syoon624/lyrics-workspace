import { describe, expect, it } from "vitest";
import { buildWordHtml, sanitizeFileName } from "./exportUtils";

describe("sanitizeFileName", () => {
  it("윈도우 금지 문자를 밑줄로 바꾼다", () => {
    expect(sanitizeFileName('a:b/c*d?"e<f>g|h')).toBe("a_b_c_d__e_f_g_h");
  });

  it("빈 문자열이면 기본 파일명을 반환한다", () => {
    expect(sanitizeFileName("")).toBe("lyrics");
  });
});

describe("buildWordHtml", () => {
  it("줄바꿈을 br 태그로 변환한다", () => {
    const html = buildWordHtml({
      title: "테스트",
      artist: "가수",
      link: "https://example.com",
      memo: "메모",
      lyrics: "첫 줄\n둘째 줄",
    });

    expect(html).toContain("첫 줄<br/>둘째 줄");
    expect(html).toContain("<title>테스트</title>");
  });
});
