import "@fontsource-variable/geist/wght.css";
import "./index.css";
import { retornoDoRd } from "@arp/shared/integracoes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/provedores";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("index.html sem o elemento #raiz");

// A volta da autorização do RD Station chega na raiz (a URL de callback
// cadastrada no app): segue para a rota de retorno da API.
const retornoRd = retornoDoRd(new URL(window.location.href));
if (retornoRd) window.location.replace(retornoRd);
else
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
