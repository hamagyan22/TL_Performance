import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Lead Dashboard",
  description: "Performance metrics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased text-[#1F2937]">{children}</body>
    </html>
  );
}
