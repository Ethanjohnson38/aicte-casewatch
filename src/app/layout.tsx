import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/app/AppShell";
import { getSessionUser } from "@/lib/session";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AICTE CaseWatch",
  description:
    "Official complaint case management and community voice for AICTE bureaus and cells.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  // Pass only what the nav needs to the client — not email/id.
  const navUser = user ? { pseudonym: user.pseudonym, role: user.role } : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full">
        <AppShell user={navUser}>{children}</AppShell>
      </body>
    </html>
  );
}
