import { AuthProvider } from "./contexts/AuthContext";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SiteSettingsProvider } from "./contexts/SiteSettings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import "./brand.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SiteSettingsProvider>
            <App />
          </SiteSettingsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
