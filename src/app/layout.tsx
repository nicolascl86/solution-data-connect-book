import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: " dogear — Find your next great read", description: "Thoughtful book recommendations for every kind of reader." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="en"><body>{children}</body></html>;
}
