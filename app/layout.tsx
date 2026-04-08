import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { zhCN } from "@clerk/localizations";
import { Montserrat, Open_Sans, Space_Grotesk, Space_Mono } from "next/font/google";
import { QueryProvider } from "@/features/shared/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "PPT XML Editor",
  description: "PPT XML Editor with Clerk authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${openSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClerkProvider localization={zhCN} signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="bottom-right" richColors />
        </ClerkProvider>
      </body>
    </html>
  );
}
