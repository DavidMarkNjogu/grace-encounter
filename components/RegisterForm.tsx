"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeKePhone } from "@/lib/phone";
import { Button, Input, Card } from "./ui";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<null | "ok" | "dup" | "invalid" | "error">(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("register_person", {
      p_name: name,
      p_phone: phone,
      p_source: "self_registered",
    });
    setSubmitting(false);
    if (error) {
      setStatus("error");
      return;
    }
    const result = data?.[0]?.result;
    if (result === "inserted") {
      setStatus("ok");
      setName("");
      setPhone("");
    } else if (result === "duplicate") {
      setStatus("dup");
    } else {
      setStatus("invalid");
    }
  }

  return (
    <Card>
      <h2 className="text-xl mb-4">Add your details</h2>
      <form onSubmit={submit} className="space-y-3">
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          placeholder="Phone number (07XX XXX XXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        {phone.trim().length >= 7 && (
          <p className={`text-xs ${normalizeKePhone(phone) ? "text-ok-300" : "text-warn-500"}`}>
            {normalizeKePhone(phone)
              ? "✓ looks like a valid Kenyan number"
              : "Doesn't look like a valid Kenyan mobile number yet"}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Adding…" : "Register"}
        </Button>
      </form>
      {status === "ok" && (
        <p className="mt-3 rounded-lg border border-ok-300/30 bg-ok-300/10 px-3 py-2 text-sm text-ok-300">
          You're on the list. See you there!
        </p>
      )}
      {status === "dup" && (
        <p className="mt-3 text-sm text-warn-500">
          That number is already registered — search above to confirm.
        </p>
      )}
      {status === "invalid" && (
        <p className="mt-3 text-sm text-warn-500">
          That doesn't look like a valid phone number — check and try again.
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-warn-500">Something went wrong — please try again.</p>
      )}
    </Card>
  );
}

