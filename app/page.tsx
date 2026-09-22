import SearchBox from "@/components/SearchBox";
import RegisterForm from "@/components/RegisterForm";

export default function HomePage() {
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
      </div>
      <footer className="mt-14 text-center text-xs text-cream-100/30">
        Admin?{" "}
        <a href="/admin" className="underline hover:text-cream-100/60">
          Sign in
        </a>
      </footer>
    </main>
  );
}
