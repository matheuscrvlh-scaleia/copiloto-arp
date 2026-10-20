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
// a escolha salva no navegador ou, sem ela, a do sistema operacional.
const temaInicial = `(function(){try{var t=localStorage.getItem("tema");var e=t?t==="escuro":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=e?"dark":"light"}catch(_){}})();`;

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
