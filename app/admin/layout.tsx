// Localização: app/admin/layout.tsx
// Lógica de autenticação e autorização, versão limpa sem logs excessivos.

import { auth } from "@clerk/nextjs/server"; // Importa auth para Server Components
import { redirect } from "next/navigation"; // Importa redirect para navegação

export default async function AdminLayout({
  // 'async' é necessário para 'auth()'
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = auth(); // Obtém o ID do usuário e os claims da sessão

  // Tenta ler o 'role' diretamente dos sessionClaims
  // Isso assume que o seu JWT Template no Clerk está configurado para adicionar:
  // { "role": "{{user.public_metadata.role}}" }
  const userRole = sessionClaims?.role as string;

  // Se não houver userId (usuário não logado) OU se o papel não for "ADMIN",
  // redireciona para a página inicial.
  if (!userId || userRole !== "ADMIN") {
    // Log de acesso negado pode ser útil manter, ou remover se preferir um ambiente de produção mais limpo
    console.log(
      `AdminLayout: Acesso Negado ou Papel Inválido. UserID: ${userId}, Role: ${userRole}. Redirecionando para /.`,
    );
    redirect("/"); // Redireciona para a página inicial
  }

  // Se chegou até aqui, o usuário está logado e é ADMIN.
  // console.log(
  //   `ADMIN LAYOUT - Acesso Permitido para UserID: ${userId} com Papel: ${userRole}.`,
  // ); // Log de acesso permitido removido para limpeza.

  return (
    <div
      className="min-h-screen bg-gray-100" // Estilos base para o layout de admin
      style={{ paddingTop: "100px" }} // Mantém um paddingTop para a NavBar fixa. Ajuste conforme necessário.
      // Ou use uma classe Tailwind como 'pt-20' ou 'pt-24'
    >
      {/* Você pode adicionar um header ou sidebar específico para o admin aqui */}
      <div className="p-6">
        {" "}
        {/* Padding interno para o conteúdo */}
        {children}{" "}
        {/* Aqui será renderizado o conteúdo de app/admin/page.tsx */}
      </div>
    </div>
  );
}
