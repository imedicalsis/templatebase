import "./globals.css";
import cx from "classnames";
import { sfPro, inter } from "./fonts";
import Footer from "@/components/layout/footer";
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Precedent - Building blocks for your Next.js project",
  description:
    "Precedent is the all-in-one solution for your Next.js project. It includes a design system, authentication, analytics, and more.",
  metadataBase: new URL("https://precedent.dev"),
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={cx(sfPro.variable, inter.variable)}>
          <div className="fixed h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-cyan-100" />
          <Suspense fallback="...">
            <Navbar />
          </Suspense>
          <main className="min-h-screen w-full">{children}</main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}