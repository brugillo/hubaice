import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hub AICE — AI Confidence Engine",
  description:
    "The confident way to collaborate with AI. Bidirectional scoring for human-AI teams.",
  openGraph: {
    title: "Hub AICE — AI Confidence Engine",
    description: "The confident way to collaborate with AI",
    url: "https://hubaice.com",
    siteName: "Hub AICE",
    type: "website",
  },
  icons: {
    icon: "/brand/AICE_logo_transparent.png",
  },
};

function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/HUBAICE_logo.svg"
            alt="HUBAICE"
            className="h-8 w-auto"
          />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Home
          </a>
          <a href="/feed" className="text-muted-foreground hover:text-foreground transition-colors">
            Feed
          </a>
          <a href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Score
          </a>
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <a
            href="/register"
            className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log In
          </a>
          <a
            href="/onboard"
            className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/HUBAICE_logo.svg"
              alt="HUBAICE"
              className="h-6 w-auto opacity-60"
            />
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <a href="/feed" className="hover:text-foreground transition-colors">Feed</a>
            <a href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</a>
            <a href="/onboard" className="hover:text-foreground transition-colors">Get Started</a>
          </nav>
          <p className="text-xs text-muted-foreground text-center md:text-right max-w-sm">
            Privacy-first scoring. Your interactions are analyzed for patterns, never stored or sold.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
