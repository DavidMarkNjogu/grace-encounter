"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function logAction(action: string, registrantId: string | null, detail: Record<string, any> = {}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;
  await supabase.from("admin_actions").insert({
    actor_email: user.email,
    action,
    registrant_id: registrantId,
    detail,
  });
}

export async function updateStatus(id: string, status: string) {
  const supabase = createClient();
  await supabase.from("registrants").update({ status }).eq("id", id);
  await logAction("status_change", id, { status });
  revalidatePath("/admin");
}

export async function updatePickupPoint(id: string, pickupPointId: string | null) {
  const supabase = createClient();
  await supabase.from("registrants").update({ pickup_point_id: pickupPointId }).eq("id", id);
  await logAction("pickup_point_change", id, { pickupPointId });
  revalidatePath("/admin");
}

export async function updateNote(id: string, note: string) {
  const supabase = createClient();
  await supabase.from("registrants").update({ note }).eq("id", id);
  await logAction("note_change", id, { note });
  revalidatePath("/admin");
}

export async function bulkImport(
  entries: { name: string; phoneRaw: string; originalListNumber?: number | null }[]
): Promise<{ inserted: number; duplicate: number; invalid: number }> {
  const supabase = createClient();
  let inserted = 0,
    duplicate = 0,
    invalid = 0;

  const chunkSize = 20;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((entry, j) =>
        supabase.rpc("register_person", {
          p_name: entry.name,
          p_phone: entry.phoneRaw,
          p_source: "bulk_import",
          p_list_number: entry.originalListNumber ?? (i + j + 1),
        })
      )
    );

    for (const { data, error } of results) {
      if (error) {
        invalid++;
        continue;
      }
      const result = data?.[0]?.result;
      if (result === "inserted") inserted++;
      else if (result === "duplicate") duplicate++;
      else invalid++;
    }
  }

  await logAction("bulk_import", null, { inserted, duplicate, invalid, attempted: entries.length });
  revalidatePath("/admin");
  return { inserted, duplicate, invalid };
}

export async function addTeamMember(email: string, role: "caller" | "admin") {
  const supabase = createClient();
  const { error } = await supabase.from("admin_users").insert({ email, role });
  if (!error) await logAction("team_member_added", null, { email, role });
  revalidatePath("/admin");
  return { error: error?.message ?? null };
}

export async function addPickupPoint(name: string) {
  const supabase = createClient();
  await supabase.from("pickup_points").insert({ name });
  await logAction("pickup_point_added", null, { name });
  revalidatePath("/admin");
}

export async function updateEventInfo(
  venueName: string,
  venueLat: number | null,
  venueLng: number | null,
  faq: { q: string; a: string }[]
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_info")
    .update({ venue_name: venueName, venue_lat: venueLat, venue_lng: venueLng, faq })
    .eq("id", true);
  if (!error) await logAction("event_info_updated", null, {});
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: error?.message ?? null };
}

export async function dismissPossibleDuplicate(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("dismiss_possible_duplicate", { p_id: id });
  if (!error) await logAction("duplicate_dismissed", id, {});
  revalidatePath("/admin");
  return { error: error?.message ?? null };
}

export async function removeRegistrant(id: string, reason: string) {
  const supabase = createClient();
  const { error } = await supabase.from("registrants").delete().eq("id", id);
  if (!error) await logAction("registrant_removed", id, { reason });
  revalidatePath("/admin");
  return { error: error?.message ?? null };
}
