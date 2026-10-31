import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { HaloProvider } from "@/components/halo/HaloProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "Halo — Assistive Brain-Computer Interface",
  description:
    "Real-time motor imagery decoding platform replaying BCI Competition IV 2a data for assistive communication and wheelchair control.",
  keywords: [
    "BCI",
    "Brain-Computer Interface",
    "EEG",
    "Motor Imagery",
    "Assistive Technology",
    "ALS",
    "Neurotechnology",
    "CSP",
    "EEGNet",
  ],
  authors: [{ name: "Halo BCI Core Team" }],
  openGraph: {
    title: "Halo — Assistive Brain-Computer Interface",
    description:
      "Restoring independent control for people with motor impairments using 100 ms real-time EEG decoding.",
    url: "http://localhost:3000",
    siteName: "Halo BCI",
    images: [
      {
        url: "/og-image.png",
        width: 1440,
        height: 900,
        alt: "Halo BCI Interface Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Halo — Assistive Brain-Computer Interface",
    description:
      "Restoring independent control for people with motor impairments using 100 ms real-time EEG decoding.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
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
        className={`${geistSans.variable} ${geistMono.variable} bg-[#07080A] text-[#F2F4F7] antialiased selection:bg-[#4CC9F0]/20 selection:text-[#4CC9F0] min-h-screen`}
      >
        <HaloProvider>{children}</HaloProvider>
      </body>
    </html>
  );
}
