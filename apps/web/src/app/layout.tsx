import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppViewX AI Assistant",
  description: "AI-powered sales assistant for AppViewX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
