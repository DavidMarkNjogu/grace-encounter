import type { Metadata } from "next";
import "./globals.css";
import PostHogInit from "@/components/PostHogInit";

export const metadata: Metadata = {
  title: "Grace Encounter — Registration",
  description: "Registration lookup and transport sign-up for Grace Encounter, Nairobi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
