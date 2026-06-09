import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "Primum · Benchmark de seguridad clínica en español",
  description:
    "El primer benchmark abierto, safety-first y agéntico que mide si un modelo —incluido uno local como MedGemma/Gemma— es seguro para una clínica de habla hispana.",
  applicationName: "Primum",
  appleWebApp: { capable: true, title: "Primum", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Primum · Benchmark de seguridad clínica",
    description: "Frontier ~100% vs modelo médico local 51%. ¿Es seguro tu modelo de IA en la clínica?",
    locale: "es_MX",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#00a896",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
