import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARP",
  description: "ERP da ARP",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
