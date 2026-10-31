import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/server/auth/session";
import { LoginForm } from "@/components/admin/AuthForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  if (await getCurrentAdmin()) redirect("/admin");
  const sp = await searchParams;
  const notice =
    sp.timeout ? "You were signed out because of inactivity. Please sign in again."
    : sp.reset ? "Your password was changed. Sign in with the new password."
    : undefined;
  return <LoginForm notice={notice} />;
}
