import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("role")
    .eq("email", user!.email)
    .maybeSingle();

  const [{ data: registrants }, { data: pickupPoints }] = await Promise.all([
    supabase.from("registrants").select("*").order("created_at", { ascending: false }),
    supabase.from("pickup_points").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <AdminDashboard
      initialRegistrants={registrants ?? []}
      pickupPoints={pickupPoints ?? []}
      role={adminRow?.role ?? "caller"}
      selfEmail={user!.email!}
    />
  );
}
