import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import "./globals.css";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ציוד חוות פאנדנגו בצפון",
  description: "ניהול מלאי, חוסרים ומיכלים משולטים בבית העמק, להבות חביבה וכפר חסידים",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
