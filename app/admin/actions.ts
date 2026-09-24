"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeKePhone } from "@/lib/phone";

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
          p_list_number: entry.originalListNumber ?? null,
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

export async function removeTeamMember(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (!error) await logAction("team_member_removed", null, { id });
  revalidatePath("/admin");
  return { error: error?.message ?? null };
}

/** Clean all existing names in the database: strip leading numbers, trailing junk, Title Case */
export async function cleanAllNames(): Promise<{ updated: number; errors: number }> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("registrants")
    .select("id, name");

  if (error || !rows) return { updated: 0, errors: 1 };

  function cleanName(raw: string): string {
    let n = raw
      // Strip any leading digits + punctuation (e.g. "8.David", "15.Willie")
      .replace(/^\d{1,4}\s*[.):\-]\s*/g, "")
      // Strip trailing dashes, dots, colons, underscores, commas
      .replace(/[\s\-\u2013\u2014_.:,;]+$/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
    // Title Case: capitalize the first letter of each word
    n = n
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return n;
  }

  let updated = 0;
  let errors = 0;

  // Batch updates in chunks of 20
  const toUpdate = rows
    .map((r) => ({ id: r.id, oldName: r.name, newName: cleanName(r.name) }))
    .filter((r) => r.oldName !== r.newName);

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("registrants")
      .update({ name: row.newName })
      .eq("id", row.id);
    if (updateErr) {
      errors++;
    } else {
      updated++;
    }
  }

  await logAction("clean_all_names", null, { updated, errors, total: rows.length });
  revalidatePath("/admin");
  return { updated, errors };
}


export async function clearMissingFlag(id: string) {
  const supabase = createClient();
  await supabase.from("registrants").update({ missing_from_last_sync: false }).eq("id", id);
  await logAction("cleared_missing_flag", id);
  revalidatePath("/admin");
}

export async function syncMasterList(
  entries: { name: string; phoneRaw: string; originalListNumber?: number | null }[]
): Promise<{ inserted: number; updated: number; missingFlagged: number; invalid: number }> {
  const supabase = createClient();
  let inserted = 0,
    updated = 0,
    missingFlagged = 0,
    invalid = 0;

  // 1. Fetch all existing registrants
  const { data: existingRows, error: fetchErr } = await supabase
    .from("registrants")
    .select("id, phone_canonical");

  if (fetchErr || !existingRows) {
    return { inserted: 0, updated: 0, missingFlagged: 0, invalid: existingRows ? 0 : 1 };
  }

  // 2. Map entries by canonical phone (ignoring entries with no phone for matching purposes)
  const matchedDbIds = new Set<string>();

  const chunkSize = 20;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (entry, j) => {
        const listNumber = entry.originalListNumber ?? null;
        const canonPhone = normalizeKePhone(entry.phoneRaw);
        
        // Find if this phone already exists in DB
        const existing = canonPhone ? existingRows.find(r => r.phone_canonical === canonPhone) : null;

        if (existing) {
          // It's a match! Update list_number and clear missing flag, leave everything else untouched.
          matchedDbIds.add(existing.id);
          const { error } = await supabase
            .from("registrants")
            .update({ 
              list_number: listNumber,
              missing_from_last_sync: false
            })
            .eq("id", existing.id);
          return { type: error ? "invalid" : "updated" };
        } else {
          // No match. Insert via RPC.
          const { data, error } = await supabase.rpc("register_person", {
            p_name: entry.name,
            p_phone: entry.phoneRaw,
            p_source: "sync_master",
            p_list_number: listNumber,
          });
          if (error) return { type: "invalid" };
          const result = data?.[0]?.result;
          if (result === "inserted") return { type: "inserted" };
          // If the RPC returned 'duplicate' (maybe due to name deduplication logic?), we count it as updated or invalid?
          // Since user said NEVER match by name, if RPC deduplicates by name, that contradicts the user... 
          // Wait, the RPC deduplicates by exact phone or canonical phone. It does NOT deduplicate by name!
          return { type: result === "duplicate" ? "updated" : "invalid" };
        }
      })
    );

    for (const res of results) {
      if (res.type === "inserted") inserted++;
      else if (res.type === "updated") updated++;
      else invalid++;
    }
  }

  // 3. Flag anyone NOT matched in this sync as missing
  const missingIds = existingRows.filter(r => !matchedDbIds.has(r.id)).map(r => r.id);
  
  if (missingIds.length > 0) {
    // Update in batches
    for (let i = 0; i < missingIds.length; i += chunkSize) {
      const chunkIds = missingIds.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("registrants")
        .update({ missing_from_last_sync: true })
        .in("id", chunkIds);
      if (!error) missingFlagged += chunkIds.length;
    }
  }

  await logAction("sync_master_list", null, { inserted, updated, missingFlagged, invalid, attempted: entries.length });
  revalidatePath("/admin");
  return { inserted, updated, missingFlagged, invalid };
}
