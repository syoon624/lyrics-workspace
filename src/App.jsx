import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import WritePage from "./pages/WritePage";
import StoragePage from "./pages/StoragePage";
import DraftsPage from "./pages/DraftsPage";
import ProfilePage from "./pages/ProfilePage";

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><p style={{ padding: 20 }}>로딩 중...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/write" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/write" element={<WritePage />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/drafts" element={<DraftsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/write" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
