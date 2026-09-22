"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateStatus(id: string, status: string) {
  const supabase = createClient();
  await supabase.from("registrants").update({ status }).eq("id", id);
  revalidatePath("/admin");
}

export async function updatePickupPoint(id: string, pickupPointId: string | null) {
  const supabase = createClient();
  await supabase.from("registrants").update({ pickup_point_id: pickupPointId }).eq("id", id);
  revalidatePath("/admin");
}

export async function updateNote(id: string, note: string) {
  const supabase = createClient();
  await supabase.from("registrants").update({ note }).eq("id", id);
  revalidatePath("/admin");
}

export async function bulkImport(
  entries: { name: string; phoneRaw: string }[]
): Promise<{ inserted: number; duplicate: number; invalid: number }> {
  const supabase = createClient();
  
  const results = await Promise.all(
    entries.map((entry) =>
      supabase.rpc("register_person", {
        p_name: entry.name,
        p_phone: entry.phoneRaw,
        p_source: "bulk_import",
      })
    )
  );

  let inserted = 0,
    duplicate = 0,
    invalid = 0;

  for (const { data, error } of results) {
    if (error) continue;
    const result = data?.[0]?.result;
    if (result === "inserted") inserted++;
    else if (result === "duplicate") duplicate++;
    else invalid++;
  }

  revalidatePath("/admin");
  return { inserted, duplicate, invalid };
}

export async function addTeamMember(email: string, role: "caller" | "admin") {
  const supabase = createClient();
  const { error } = await supabase.from("admin_users").insert({ email, role });
  revalidatePath("/admin");
  return { error: error?.message ?? null };
}

export async function addPickupPoint(name: string) {
  const supabase = createClient();
  await supabase.from("pickup_points").insert({ name });
  revalidatePath("/admin");
}
