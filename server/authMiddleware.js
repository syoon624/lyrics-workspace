import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "lyrics-workspace-dev-secret-key-change-me";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ message: "로그인이 필요합니다." });
    return;
  }
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ message: "세션이 만료되었습니다. 다시 로그인해 주세요." });
  }
}
