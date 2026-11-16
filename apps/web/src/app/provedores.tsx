import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { clienteDeConsultas } from "@/lib/consulta";
import { MODULOS } from "./modulos";
import { montarRotas } from "./roteador";

const roteador = createBrowserRouter(montarRotas(MODULOS));

/** O app inteiro: dados (TanStack Query) em volta das rotas. */
export function App() {
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  );
}
