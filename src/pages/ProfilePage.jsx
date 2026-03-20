import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [msg, setMsg] = useState("");

  const handleSave = async (event) => {
    event.preventDefault();
    setMsg("");
    try {
      await api.patch("/api/auth/me", { displayName, email });
      await refreshUser();
      setMsg("저장되었습니다.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <section className="card">
      <h2>내 정보</h2>
      <form onSubmit={handleSave}>
        <div className="grid">
          <label>닉네임<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
        <div className="actions">
          <button type="submit">저장</button>
        </div>
        {msg ? <p className="hint">{msg}</p> : null}
      </form>
    </section>
  );
}
