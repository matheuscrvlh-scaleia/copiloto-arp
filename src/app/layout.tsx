import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "ARP Centralizador", template: "%s · ARP Centralizador" },
  description: "Centralizador de dados da ARP",
  robots: { index: false, follow: false },
};

// Aplica o tema antes da primeira pintura (sem piscar claro → escuro):
// a escolha salva no navegador ou, na primeira visita, o claro.
const temaInicial = `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("tema")==="escuro"?"dark":"light"}catch(_){document.documentElement.dataset.theme="light"}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={geist.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script fixo, sem dado do usuário */}
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body className="fundo-app min-h-dvh font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
