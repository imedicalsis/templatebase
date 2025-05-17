// Localização: app/aluno/page.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/shared/icons/loading-spinner"; // Certifique-se de que este caminho está correto

const LOADING_TIMEOUT_MS = 7000; // 7 segundos para o timeout

export default function AlunoPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingTimeout, setIsLoadingTimeout] = useState(false);

  // Efeito para lidar com a montagem do componente e o timeout de carregamento do Clerk
  useEffect(() => {
    setIsMounted(true); // Confirma que o componente foi montado no cliente

    let timerId: NodeJS.Timeout | undefined;
    // Só inicia o timer se o Clerk ainda não estiver carregado no momento da montagem
    if (!isLoaded) {
      timerId = setTimeout(() => {
        // Re-verificar isLoaded no momento do callback do timeout
        if (!isLoaded) {
          console.warn("AlunoPage: Timeout de carregamento do Clerk atingido!"); // Mantido um warn para o caso de timeout
          setIsLoadingTimeout(true); // Ativa o estado de timeout
        }
      }, LOADING_TIMEOUT_MS);
    }

    // Função de limpeza para o useEffect: remove o timer se o componente for desmontado
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [isLoaded]); // Dependência [isLoaded] para limpar o timer se o Clerk carregar antes.

  // Condição 1: Mostra o spinner enquanto o componente não estiver montado OU o Clerk não carregou E não houve timeout
  if ((!isMounted || !isLoaded) && !isLoadingTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Condição 2: Timeout de carregamento do Clerk foi atingido E o Clerk ainda não carregou
  if (isLoadingTimeout && !isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center">
        <p className="mb-4 text-xl text-red-500 opacity-100">
          Erro ao carregar dados de autenticação (timeout)
        </p>
        <p className="text-gray-700 opacity-100">
          Por favor, atualize a página. Se o problema persistir, faça logout e
          login novamente.
        </p>
      </div>
    );
  }

  // Condição 3: Clerk carregou, mas não há objeto 'user' (pode acontecer se !isSignedIn)
  // O AlunoLayout já deveria ter redirecionado se !userId, mas esta é uma verificação de segurança no cliente.
  if (isLoaded && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center">
        <p className="mb-4 text-xl text-red-500 opacity-100">
          Erro de autenticação
        </p>
        <p className="text-gray-700 opacity-100">
          {isSignedIn
            ? "Não foi possível carregar os dados do usuário."
            : "A sua sessão pode ter expirado. Por favor, faça login novamente."}
        </p>
      </div>
    );
  }

  // Condição 4: Tudo OK - Componente montado, Clerk carregado, e objeto 'user' existe.
  return (
    // Adicionado relative e z-10 ao container principal da página para garantir visibilidade sobre fundos
    <div className="container relative z-10 mx-auto px-4 py-8">
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-black opacity-100">
          Painel do Aluno
        </h1>
        <div className="space-y-4">
          <p className="text-gray-700 opacity-100">
            Bem-vindo à sua área de estudos,{" "}
            {user?.firstName ||
              user?.primaryEmailAddress?.emailAddress ||
              "Aluno"}
            !
          </p>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-sm text-gray-700 opacity-100">
              Email:{" "}
              {user?.primaryEmailAddress?.emailAddress ||
                "Email não disponível"}
            </p>
            {/* Adicione aqui links para os cursos, progresso, avaliações, flashcards do aluno */}
            <p className="mt-4 text-sm text-blue-600 hover:underline">
              <a href="#">Meus Cursos</a>
            </p>
            <p className="mt-2 text-sm text-blue-600 hover:underline">
              <a href="#">Minhas Avaliações</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
