import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import SmoothScroll from "./components/SmoothScroll";
import Board from "./pages/Board";
import Jobs from "./pages/Jobs";
import Login from "./pages/Login";
import Profile from "./pages/Profile";

// The charts library is the heaviest part of the bundle, so it loads only when the page opens
const Dashboard = lazy(() => import("./pages/Dashboard"));

export default function App() {
  const { signedIn } = useAuth();
  return (
    <>
      <SmoothScroll />
      {signedIn ? (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Jobs />} />
            <Route path="board" element={<Board />} />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<div className="skeleton h-40" />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      ) : (
        <Login />
      )}
    </>
  );
}
