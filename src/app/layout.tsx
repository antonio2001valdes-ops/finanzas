import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KHORVEN Finanzas Personales v3.2.0",
  description: "Gestión de finanzas personales con estética Cyberpunk/Neon. Moneda: CLP. Idioma: Español (Chile).",
  keywords: ["finanzas", "personal", "presupuesto", "Cyberpunk", "Neon", "CLP", "Chile"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--neon-blue)',
              color: 'var(--foreground)',
            },
          }}
        />
      </body>
    </html>
  );
}
