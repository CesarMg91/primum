import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./sw-register";
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION, KEYWORDS } from "./seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Primum",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  authors: [{ name: "César Méndez García" }],
  creator: "César Méndez García",
  publisher: "AMIA Health Tech",
  category: "health",
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "Primum · Benchmark de seguridad clínica",
    description:
      "Frontier ~100% vs modelo médico local. ¿Es seguro tu modelo de IA en la clínica? Benchmark abierto, safety-first, en español.",
    locale: "es_MX",
  },
  twitter: {
    card: "summary_large_image",
    title: "Primum · Benchmark de seguridad clínica",
    description: "¿Es seguro tu modelo de IA en una clínica de habla hispana? Benchmark abierto y safety-first.",
  },
};

export const viewport: Viewport = {
  themeColor: "#00a896",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "es-MX",
    },
    {
      "@type": "Dataset",
      "@id": `${SITE_URL}/#dataset`,
      name: "Primum — corpus de seguridad clínica (es-MX)",
      description:
        "Corpus abierto y agéntico de casos clínicos en español mexicano para medir la seguridad de modelos de IA médica (primum non nocere). Cada caso evalúa un modo de falla peligroso con una rúbrica binaria verificable.",
      url: SITE_URL,
      inLanguage: "es-MX",
      license: "https://opensource.org/licenses/MIT",
      keywords: KEYWORDS,
      isAccessibleForFree: true,
      creator: {
        "@type": "Person",
        name: "César Méndez García",
        affiliation: { "@type": "Organization", name: "AMIA Health Tech" },
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: SITE_DESCRIPTION,
      url: SITE_URL,
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
