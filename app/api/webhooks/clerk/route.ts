import { headers } from "next/headers";
import { WebhookEvent, UserJSON } from "@clerk/nextjs/server"; // UserJSON importado para tipagem correta
import { Webhook } from "svix"; // Pacote para verificação da assinatura do webhook
import { PrismaClient, Role } from "@prisma/client"; // Role importado para tipagem

// Recomenda-se usar uma instância singleton do Prisma em produção.
// Exemplo: criar um arquivo lib/prisma.ts
// import { PrismaClient } from '@prisma/client'
// export const prisma = new PrismaClient()
// E depois importar aqui: import { prisma } from '@/lib/prisma';
const prisma = new PrismaClient(); // Instância local para simplicidade agora

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// Função para validar a requisição do webhook
async function validateRequest(req: Request, headersList: Headers) {
  if (!WEBHOOK_SECRET) {
    console.error(
      "CRITICAL: CLERK_WEBHOOK_SECRET is not defined in environment variables.",
    );
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or Replit Secrets",
    );
  }

  // Obtenção dos headers Svix necessários para validação
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Webhook request missing Svix headers.");
    throw new Error("Error occured -- no svix headers");
  }

  const payload = await req.json(); // O corpo da requisição
  const body = JSON.stringify(payload); // O Svix espera o corpo como uma string

  const wh = new Webhook(WEBHOOK_SECRET); // Instancia o webhook Svix com o seu segredo
  try {
    // Verifica a assinatura. Se for inválida, lança um erro.
    return wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent; // Faz o cast para o tipo WebhookEvent do Clerk
  } catch (err: any) {
    console.error("Error verifying webhook signature:", err.message);
    throw new Error("Error verifying webhook signature: Invalid signature.");
  }
}

// Handler para requisições POST (o Clerk envia webhooks como POST)
export async function POST(req: Request) {
  // Log inicial para confirmar que a rota está a ser chamada
  console.log(
    `!!! WEBHOOK /api/webhooks/clerk ROTA ACIONADA !!! Timestamp: ${new Date().toISOString()}`,
  );

  try {
    const headersList = headers(); // Obtém os headers da requisição atual
    const evt = await validateRequest(req, headersList); // Valida a requisição
    const eventType = evt.type; // Tipo do evento (ex: 'user.created')
    const eventData = evt.data; // Dados do evento

    console.log(`Received webhook event: ${eventType} for ID: ${eventData.id}`);

    // Garante que eventData.id existe para operações de banco de dados
    const clerkIdFromEvent = eventData.id;
    if (!clerkIdFromEvent) {
      console.error("Webhook event data is missing 'id'. Event:", evt);
      return new Response("Error: Event data missing ID", { status: 400 });
    }

    switch (eventType) {
      case "user.created":
        // Para user.created, eventData é do tipo UserJSON
        const createdUserData = eventData as UserJSON;
        // Lê o 'role' dos publicMetadata (se existir)
        const rawRoleCreated = (createdUserData.public_metadata as any)
          ?.role as string | undefined;
        // Define o papel para o tipo Enum do Prisma, com ALUNO como padrão
        const roleToCreate: Role =
          rawRoleCreated === Role.ADMIN ? Role.ADMIN : Role.ALUNO;
        const emailCreated =
          createdUserData.email_addresses?.[0]?.email_address;

        // Verifica se o email existe, pois é obrigatório no schema User
        if (!emailCreated) {
          console.error(
            `User ${clerkIdFromEvent} created event missing email. Skipping DB create.`,
          );
          return new Response("Error: User created event missing email", {
            status: 400,
          });
        }

        // Cria o utilizador no banco de dados
        await prisma.user.create({
          data: {
            clerkUserID: clerkIdFromEvent,
            email: emailCreated,
            role: roleToCreate,
            nome: createdUserData.first_name || undefined, // Adiciona o primeiro nome se existir
          },
        });
        console.log(
          `User ${clerkIdFromEvent} created in local DB with role ${roleToCreate}.`,
        );
        break;

      case "user.updated":
        // Para user.updated, eventData é do tipo UserJSON
        const updatedUserData = eventData as UserJSON;
        const rawRoleUpdated = (updatedUserData.public_metadata as any)
          ?.role as string | undefined;

        const dataToUpdate: {
          email?: string; // Email é obrigatório, só atualiza se tiver um novo válido
          role?: Role;
          nome?: string | null; // Nome é opcional
        } = {};

        const emailUpdated =
          updatedUserData.email_addresses?.[0]?.email_address;
        if (emailUpdated) {
          dataToUpdate.email = emailUpdated;
        }

        // Atualiza o papel se um valor válido for fornecido
        if (rawRoleUpdated === Role.ADMIN || rawRoleUpdated === Role.ALUNO) {
          dataToUpdate.role = rawRoleUpdated as Role;
        }

        // Atualiza o nome se fornecido, ou define como null se ausente
        dataToUpdate.nome = updatedUserData.first_name || null;

        // Só executa a atualização se houver dados para atualizar
        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.user.update({
            where: { clerkUserID: clerkIdFromEvent },
            data: dataToUpdate,
          });
          console.log(`User ${clerkIdFromEvent} updated in local DB.`);
        } else {
          console.log(
            `User ${clerkIdFromEvent} update event received, but no relevant data changed or provided for DB update.`,
          );
        }
        break;

      case "user.deleted":
        // Para user.deleted, eventData é DeletedObjectJSON, que só tem 'id' e 'deleted'.
        // clerkIdFromEvent já foi extraído e verificado.
        const userExists = await prisma.user.findUnique({
          where: { clerkUserID: clerkIdFromEvent },
        });
        if (userExists) {
          await prisma.user.delete({
            where: { clerkUserID: clerkIdFromEvent },
          });
          console.log(`User ${clerkIdFromEvent} deleted from local DB.`);
        } else {
          console.log(
            `User ${clerkIdFromEvent} for deletion not found in local DB. Skipping.`,
          );
        }
        break;
      default:
        // Log para eventos não tratados
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // Retorna sucesso para o Clerk
    return new Response("Webhook processed successfully", { status: 200 });
  } catch (error: any) {
    // Tratamento de erros
    console.error("Error processing webhook:", error.message);
    const status = error.message.includes("Invalid signature") ? 401 : 500; // Status HTTP apropriado
    return new Response(
      JSON.stringify({
        error: "Error processing webhook",
        details: error.message,
      }),
      { status },
    );
  }
}
