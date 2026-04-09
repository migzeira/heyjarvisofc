import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Registro do Service Worker (PWA) ────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registrado:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Falha no registro:", err);
      });
  });
}
