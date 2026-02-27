import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hub AICE — AI Confidence Engine",
  description:
    "Mi IA me pone un 46% como jefe. ¿Y la tuya? Scoring bidireccional para equipos humano-IA.",
  openGraph: {
    title: "Hub AICE — AI Confidence Engine",
    description: "Scoring bidireccional para equipos humano-IA",
    url: "https://aice.eurekis.es",
    siteName: "Hub AICE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased">
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="text-lg font-bold tracking-tight">
              <span className="text-primary">Hub</span>{" "}
              <span className="text-accent">AICE</span>
            </a>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="/leaderboard" className="hover:text-primary transition-colors">
                Leaderboard
              </a>
              <a href="/register" className="hover:text-accent transition-colors">
                Register
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
          <p>
            <span className="text-primary">Hub</span>{" "}
            <span className="text-accent">AICE</span>{" "}
            — AI Confidence Engine
          </p>
        </footer>
      </body>
    </html>
  );
}
