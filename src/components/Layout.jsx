import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/write", label: "가사 작성" },
  { to: "/storage", label: "저장소" },
  { to: "/drafts", label: "임시 저장" },
  { to: "/profile", label: "내 정보" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-row">
          <h1 onClick={() => navigate("/write")} style={{ cursor: "pointer" }}>
            작사 워크스페이스
          </h1>
          <div className="topbar-right">
            <span>{user?.displayName || user?.email}</span>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
        <nav className="tabs">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="layout">
        <Outlet />
      </main>
    </div>
  );
}
