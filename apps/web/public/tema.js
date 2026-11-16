// Aplica o tema antes da primeira pintura (sem piscar claro → escuro):
// a escolha salva no navegador ou, na primeira visita, o claro.
(() => {
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("tema") === "escuro" ? "dark" : "light";
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();
