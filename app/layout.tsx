import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Hoặc font mặc định dự án bạn vừa tạo
import "./globals.css";
// 1. Import file Providers vừa tạo ở Bước 3
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wyck Club - Base Ecosystem",
  description: "Web3 App on Base Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 2. Bọc thẻ <Providers> quanh {children} ở đây */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}