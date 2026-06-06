import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Primum · Benchmark de seguridad clínica en español",
  description:
    "El primer benchmark abierto, safety-first y agéntico que mide si un modelo —incluido uno local como MedGemma/Gemma— es seguro para una clínica de habla hispana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
