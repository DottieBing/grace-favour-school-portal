import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "School Management | Grace & Favour Model School",
    template: "%s | Grace & Favour Model School",
  },
  description:
    "The school administration platform for Grace & Favour Model School.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}