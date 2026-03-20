const TOKEN_KEY = "lyrics-ws-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error(data.message || "인증 오류");
  }
  if (!response.ok) throw new Error(data.message || "요청 실패");
  return data;
}

export const api = {
  get: (url) => request(url),
  post: (url, body) =>
    request(url, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (url, body) => request(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (url) => request(url, { method: "DELETE" }),
};
