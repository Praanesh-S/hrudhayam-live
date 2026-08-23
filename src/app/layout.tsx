import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrudhayam LIVE — Seat & Pass Manager",
  description:
    "Internal admin tool for managing seats and donation passes for Hrudhayam LIVE, a Rotary Club charity concert at The Music Academy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark antialiased">
      <body className="min-h-full flex flex-col font-sans bg-[#0B131E] text-[#F1F5F9]">
        <TooltipProvider>
          {children}
          <Toaster richColors theme="dark" position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
