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
        const listNumber = entry.originalListNumber ?? (i + j + 1);
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
