import SearchBox from "@/components/SearchBox";
import RegisterForm from "@/components/RegisterForm";
import EventInfo from "@/components/EventInfo";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const { data: info } = await supabase.from("event_info").select("*").eq("id", true).maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <header className="mb-10 text-center">
        <p className="text-gold-400 text-sm tracking-[0.2em] uppercase mb-2">
          Grace Encounter · Nairobi
        </p>
        <h1 className="text-3xl md:text-4xl font-medium">Free Transport Registration</h1>
        <p className="mt-3 text-cream-100/60 text-sm">
          Check if you're already on the list, or add yourself below.
        </p>
      </header>
      <div className="space-y-6">
        <SearchBox />
        <RegisterForm />
        <EventInfo
          venueName={info?.venue_name ?? null}
          venueLat={info?.venue_lat ?? null}
          venueLng={info?.venue_lng ?? null}
          faq={info?.faq ?? []}
        />
      </div>
      <footer className="mt-14 text-center text-xs text-cream-100/60">
        Admin?{" "}
        <a href="/admin" className="text-gold-400 underline hover:text-gold-300">
          Sign in
        </a>
      </footer>
    </main>
  );
}
