import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel do condomínio",
  description: "Gestão de encomendas da portaria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
