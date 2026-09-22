"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card } from "@/components/ui";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-24">
      <Card>
        <h1 className="text-xl mb-1">Admin sign-in</h1>
        <p className="text-sm text-cream-100/60 mb-5">
          Enter the email that's been added to the team list — you'll get a magic link.
        </p>
        {sent ? (
          <p className="text-ok-500 text-sm">Check your inbox for the sign-in link.</p>
        ) : (
          <form onSubmit={sendLink} className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send magic link"}
            </Button>
            {error && <p className="text-sm text-warn-500">{error}</p>}
          </form>
        )}
      </Card>
    </main>
  );
}
