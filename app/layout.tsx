import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tattoo 4 You | See Your Ink Before You Commit",
  description: "Visualize any tattoo design on your own body before the needle touches skin.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
