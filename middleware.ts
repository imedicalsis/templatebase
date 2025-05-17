import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define quais rotas são consideradas de administrador
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Define quais rotas são consideradas de aluno
const isAlunoRoute = createRouteMatcher(["/aluno(.*)"]);

// Rotas públicas que não exigem autenticação para serem acessadas
const isPublicRoute = createRouteMatcher([
  "/", // A página inicial
  "/sign-in(.*)", // Páginas de login
  "/sign-up(.*)", // Páginas de cadastro
  "/api/webhooks/clerk", // A rota do webhook DEVE ser pública
]);

export default clerkMiddleware((auth, req) => {
  const { userId, sessionClaims } = auth();

  if (userId) {
    console.log(
      "CLERK SESSION CLAIMS (com tentativa de publicMetadata direto):",
      JSON.stringify(sessionClaims, null, 2),
    );

    // Tenta ler 'role' de múltiplos locais possíveis nos claims
    // Prioridade 1: sessionClaims.role (se o JWT template colocar 'role' diretamente)
    // Prioridade 2: sessionClaims.publicMetadata.role (se o JWT template colocar todo o objeto 'publicMetadata')
    const userRole = (sessionClaims?.role ||
      (sessionClaims?.publicMetadata as any)?.role) as string;

    console.log("USER ROLE FROM MIDDLEWARE (tentativa flexível):", userRole);
  }

  if (!isPublicRoute(req) && !userId) {
    const appPublicUrl = process.env.NEXT_PUBLIC_URL;

    console.log(
      "DEBUG: Middleware - Unauthenticated access to non-public route.",
    );
    console.log("DEBUG: req.nextUrl.origin:", req.nextUrl.origin);
    console.log("DEBUG: process.env.NEXT_PUBLIC_URL:", appPublicUrl);

    if (!appPublicUrl) {
      console.error(
        "CRITICAL ERROR: NEXT_PUBLIC_URL is not defined in Replit Secrets!",
      );
      return auth().redirectToSignIn({ returnBackUrl: req.nextUrl.pathname });
    }

    const targetPathname = req.nextUrl.pathname;
    const publicRedirectUrl = new URL(targetPathname, appPublicUrl).toString();
    console.log("DEBUG: Constructed publicRedirectUrl:", publicRedirectUrl);
    return auth().redirectToSignIn({ returnBackUrl: publicRedirectUrl });
  }

  if (userId) {
    const userRole = (sessionClaims?.role ||
      (sessionClaims?.publicMetadata as any)?.role) as string;

    if (isAdminRoute(req)) {
      if (userRole !== "ADMIN") {
        console.log(
          `Redirecting non-ADMIN user from /admin. Detected Role: ${userRole}`,
        );
        return NextResponse.redirect(new URL("/aluno", req.url));
      }
    }

    if (isAlunoRoute(req)) {
      if (userRole !== "ALUNO" && userRole !== "ADMIN") {
        console.log(
          `Redirecting user with unhandled role '${userRole}' from /aluno.`,
        );
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
