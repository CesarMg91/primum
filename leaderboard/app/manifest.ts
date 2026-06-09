import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Primum · Benchmark de seguridad clínica",
    short_name: "Primum",
    description:
      "¿Es seguro este modelo de IA en una clínica real de habla hispana? Benchmark safety-first en español.",
    start_url: "/",
    display: "standalone",
    background_color: "#042f2e",
    theme_color: "#00a896",
    lang: "es-MX",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
