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

  const [{ data: registrants }, { data: pickupPoints }, { data: eventInfo }, { data: duplicates }] =
    await Promise.all([
      supabase.from("registrants").select("*").order("created_at", { ascending: false }),
      supabase.from("pickup_points").select("*").eq("is_active", true).order("name"),
      supabase.from("event_info").select("*").eq("id", true).maybeSingle(),
      supabase.from("possible_duplicates").select("*"),
    ]);

  return (
    <AdminDashboard
      initialRegistrants={registrants ?? []}
      pickupPoints={pickupPoints ?? []}
      role={adminRow?.role ?? "caller"}
      selfEmail={user!.email!}
      eventInfo={{
        venue_name: eventInfo?.venue_name ?? null,
        venue_lat: eventInfo?.venue_lat ?? null,
        venue_lng: eventInfo?.venue_lng ?? null,
        faq: eventInfo?.faq ?? [],
      }}
      duplicates={duplicates ?? []}
    />
  );
}
