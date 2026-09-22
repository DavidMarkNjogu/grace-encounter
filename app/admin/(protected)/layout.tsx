import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("role")
    .eq("email", user.email)
    .maybeSingle();

  if (!adminRow) {
    return (
      <main className="mx-auto max-w-sm px-5 py-24 text-center">
        <h1 className="text-xl mb-2">Not on the team list</h1>
        <p className="text-sm text-cream-100/60">
          {user.email} isn't registered as an admin or caller yet. Ask an existing admin to add you.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
