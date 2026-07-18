import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "@livekit/components-styles";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
import { Toaster } from "sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kanvise — Run your school. We handle the engine.",
  description: "Kanvise is the private operating system for serious Nigerian tutors — giving you the tools to run classes, track performance, collect payments, and manage your students like a real school. Invite-only. Built for you.",
  icons: {
    icon: "/kanvise_logo_small_blue.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} no-scrollbar`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@300,1,0,24&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased overflow-x-hidden no-scrollbar">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
