import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
      navigate("/write");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page login-page">
      <div className="login-card">
        <h1>작사 워크스페이스</h1>
        <p className="hint">{isRegister ? "회원가입" : "로그인"}</p>
        <form onSubmit={handleSubmit}>
          {isRegister ? (
            <label>
              닉네임
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          ) : null}
          <label>
            이메일
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">{isRegister ? "회원가입" : "로그인"}</button>
        </form>
        <button type="button" className="ghost toggle-btn" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "이미 계정이 있나요? 로그인" : "처음이신가요? 회원가입"}
        </button>
      </div>
    </div>
  );
}
