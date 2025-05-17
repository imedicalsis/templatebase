// Localização provável: components/layout/navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState, useEffect } from "react"; // Adicionado useState e useEffect
import useScroll from "@/lib/hooks/use-scroll";
import {
  ClerkLoaded, // Ainda é bom manter para a lógica interna do Clerk
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";

export default function NavBar() {
  const scrolled = useScroll(50);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Define como montado apenas no lado do cliente
  }, []);

  return (
    <Suspense fallback={<div className="h-16 w-full" />}>
      <div
        className={`fixed top-0 flex w-full justify-center ${
          scrolled
            ? "border-b border-gray-200 bg-white/50 backdrop-blur-xl"
            : "bg-white/0"
        } z-30 transition-all`}
      >
        <div className="mx-5 flex h-16 w-full max-w-screen-xl items-center justify-between">
          <Link href="/" className="flex items-center font-display text-2xl">
            <Image
              src="/logo.png"
              alt="Logo da Aplicação"
              width={30}
              height={30}
              className="mr-2 rounded-sm"
            />
            <p>IMEDICAL</p>
          </Link>
          <div className="flex items-center gap-2">
            {/* Só renderiza os componentes do Clerk depois que o componente estiver montado no cliente */}
            {isMounted && (
              <ClerkLoaded>
                <SignedIn>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "h-10 w-10",
                      },
                    }}
                  />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="rounded-full border border-black bg-black px-4 py-1.5 text-sm text-white transition-colors hover:bg-white hover:text-black"
                    >
                      Entrar
                    </button>
                  </SignInButton>
                </SignedOut>
              </ClerkLoaded>
            )}
            {/* Se !isMounted, nada relacionado ao Clerk é renderizado, evitando o mismatch inicial */}
            {!isMounted && (
              <div className="w-[80px] h-[40px]" /> // Placeholder para evitar layout shift
            )}
          </div>
        </div>
      </div>
    </Suspense>
  );
}