import "@fontsource-variable/geist/wght.css";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/provedores";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("index.html sem o elemento #raiz");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
