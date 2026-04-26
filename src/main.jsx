import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import AdminPage from "./pages/AdminPage.jsx";
import DownloadsPage from "./pages/DownloadsPage.jsx";
import "./styles.css";

function Layout({ children }) {
  return (
    <>
      <header>
        <h1>File Portal</h1>
        <nav>
          <NavLink to="/" end>Admin / Upload</NavLink>
          <NavLink to="/files">Downloads</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<AdminPage />} />
          <Route path="/files" element={<DownloadsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
);
