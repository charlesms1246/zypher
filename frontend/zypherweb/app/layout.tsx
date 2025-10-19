import type { Metadata } from "next";
import { Space_Grotesk, Orbitron } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-numeric",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Zypher Protocol | Privacy-Preserving Stablecoins on Solana",
  description: "AI-agent-driven, privacy-focused protocol for encrypted stablecoins backed by real-world assets. Silent Proofs. Loud Impact.",
  keywords: ["Solana", "stablecoin", "DeFi", "zero-knowledge", "AI", "privacy", "RWA"],
  openGraph: {
    title: "Zypher Protocol",
    description: "Privacy-preserving stablecoins powered by AI agents and zero-knowledge proofs",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${orbitron.variable} antialiased bg-[#050505] text-[#F5F5F5]`}
      >
        {children}
      </body>
    </html>
  );
}
