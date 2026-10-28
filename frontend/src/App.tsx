import { RouteMetadata } from "./components/Metadata";
import { Suspense } from "react";
import { Routes } from "react-router-dom";
import { AuthCallbackRedirect } from "./contexts/AuthContext";
import {
  staffRoutes,
  publicRoutes,
  authenticatedRoutes,
  creatorRoutes,
  customerRoutes,
  adminRoutes,
  errorRoutes,
} from "./routes";

export default function App() {
  return (
    <>
      <RouteMetadata />
      <AuthCallbackRedirect />
      <Suspense
        fallback={
          <div className="app-loading" role="status" aria-live="polite">
            <span className="loading-mark">▶</span>
            <span>Đang tải MediaHub…</span>
          </div>
        }
      >
        <Routes>
          {staffRoutes}
          {publicRoutes}
          {authenticatedRoutes}
          {creatorRoutes}
          {customerRoutes}
          {adminRoutes}
          {errorRoutes}
        </Routes>
      </Suspense>
    </>
  );
}
