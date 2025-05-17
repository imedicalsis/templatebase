import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { PrismaClient, Role } from "@prisma/client"; // Importe Role do Prisma Client

// Recomenda-se usar uma instância singleton do Prisma em produção para otimizar conexões.
// Ex: crie um arquivo lib/prisma.ts e importe 'prisma' de lá.
// Para este exemplo, manteremos a instanciação local, mas é um ponto de atenção.
const prisma = new PrismaClient();

async function validateRequest(req: Request, headersList: Headers) {
  // Parâmetro 'headersList' agora é do tipo 'Headers'
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    // É crucial que esta variável esteja configurada nos Secrets do Replit.
    console.error("CLERK_WEBHOOK_SECRET not found in environment variables.");
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or Replit Secrets",
    );
  }

  // Obter os headers específicos do Svix (usados pelo Clerk para webhooks)
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  // Se algum dos headers Svix não estiver presente, é um erro.
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing Svix headers");
    throw new Error("Error occured -- no svix headers");
  }

  // Obter o payload (corpo da requisição) como JSON.
  const payload = await req.json();
  const body = JSON.stringify(payload); // O Svix espera o corpo como string para verificação.

  // Criar uma nova instância do Webhook Svix com seu secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    // Verificar a assinatura do payload. Se não for válida, um erro será lançado.
    return wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent; // Faz o cast para o tipo WebhookEvent do Clerk.
  } catch (err: any) {
    // Captura qualquer erro durante a verificação.
    console.error("Error verifying webhook signature:", err.message);
    throw new Error("Error verifying webhook signature: Invalid signature.");
  }
}

export async function POST(req: Request) {
  try {
    const headersList = headers(); // Obtém os headers da requisição atual.
    const evt = await validateRequest(req, headersList); // Valida a requisição.
    const eventType = evt.type; // Tipo do evento (ex: 'user.created').
    const eventData = evt.data; // Dados do evento (contém o objeto User do Clerk).

    console.log(
      `Received webhook event: ${eventType} for Clerk User ID: ${eventData.id}`,
    );

    switch (eventType) {
      case "user.created":
        // Tenta obter o 'role' dos metadados públicos do usuário no Clerk.
        const rawRoleCreated = (eventData.public_metadata as any)?.role as
          | string
          | undefined;
        // Define o role para o enum do Prisma, com 'ALUNO' como padrão.
        const roleToCreate: Role =
          rawRoleCreated === Role.ADMIN ? Role.ADMIN : Role.ALUNO;

        await prisma.user.create({
          data: {
            clerkUserID: eventData.id, // Corrigido para clerkUserID
            email: eventData.email_addresses?.[0]?.email_address ?? null, // Corrigido e mais seguro
            // Você pode adicionar outros campos como nome, se configurados no Clerk e no seu schema
            // nome: eventData.first_name,
            role: roleToCreate,
          },
        });
        console.log(
          `User ${eventData.id} created in local DB with role ${roleToCreate}.`,
        );
        break;

      case "user.updated":
        const rawRoleUpdated = (eventData.public_metadata as any)?.role as
          | string
          | undefined;
        // Prepara o objeto de dados para atualização. Só inclui campos que realmente existem.
        const dataToUpdate: {
          email?: string | null;
          role?: Role;
          // Adicione outros campos que queira sincronizar
          // nome?: string | null;
        } = {
          email: eventData.email_addresses?.[0]?.email_address ?? null,
          // nome: eventData.first_name ?? null,
        };

        // Atualiza o 'role' apenas se um valor válido for fornecido nos metadados.
        if (rawRoleUpdated === Role.ADMIN || rawRoleUpdated === Role.ALUNO) {
          dataToUpdate.role = rawRoleUpdated as Role;
        }
        // Se rawRoleUpdated for undefined/null, o role existente no DB não será alterado por esta chave.

        await prisma.user.update({
          where: { clerkUserID: eventData.id }, // Corrigido para clerkUserID
          data: dataToUpdate,
        });
        console.log(`User ${eventData.id} updated in local DB.`);
        break;

      case "user.deleted":
        // Opcional: verificar se o usuário existe antes de tentar deletar.
        // O Clerk pode enviar um evento de deleção para um usuário que não chegou a ser criado no seu DB
        // se o webhook 'user.created' falhou anteriormente por algum motivo.
        const userToDelete = await prisma.user.findUnique({
          where: { clerkUserID: eventData.id }, // Corrigido para clerkUserID
        });

        if (userToDelete) {
          await prisma.user.delete({
            where: { clerkUserID: eventData.id }, // Corrigido para clerkUserID
          });
          console.log(`User ${eventData.id} deleted from local DB.`);
        } else {
          console.log(
            `User ${eventData.id} for deletion not found in local DB. Skipping.`,
          );
        }
        break;
      default:
        // É uma boa prática logar eventos não tratados para o caso de você querer suportá-los no futuro.
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // Retorna uma resposta de sucesso para o Clerk.
    return new Response("Webhook processed successfully", { status: 200 });
  } catch (error: any) {
    // Loga o erro no servidor e retorna uma resposta de erro para o Clerk.
    console.error("Error processing webhook:", error.message);
    // Não envie error.stack para o cliente em produção por motivos de segurança.
    return new Response(
      JSON.stringify({
        error: "Error processing webhook",
        details: error.message,
      }),
      { status: error.message.includes("Invalid signature") ? 401 : 500 }, // 401 para falha de assinatura, 500 para outros erros internos
    );
  }
}
