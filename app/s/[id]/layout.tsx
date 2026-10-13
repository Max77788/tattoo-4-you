import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Tattoo Preview | Tattoo 4 You",
  robots: { index: false, follow: false },
};

export default function SharedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
