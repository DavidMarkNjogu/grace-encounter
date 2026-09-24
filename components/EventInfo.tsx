import { Card } from "./ui";

interface FaqItem { q: string; a: string }
interface EventInfoProps {
  venueName: string | null;
  venueLat: number | null;
  venueLng: number | null;
  faq: FaqItem[];
}

export default function EventInfo({ venueName, venueLat, venueLng, faq }: EventInfoProps) {
  const hasPin = venueLat != null && venueLng != null;
  return (
    <div className="space-y-4">
      {faq.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg">Frequently asked</h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <details key={i} className="group rounded-xl border border-line p-3 open:bg-surface-2">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <h2 className="mb-1 text-lg">Venue</h2>
        <p className="mb-3 text-sm text-ink-soft">{venueName ?? "To be confirmed"}</p>
        {hasPin ? (
          <iframe
            title="Venue location"
            className="h-56 w-full rounded-xl border border-line"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${venueLng! - 0.01}%2C${
              venueLat! - 0.01
            }%2C${venueLng! + 0.01}%2C${venueLat! + 0.01}&layer=mapnik&marker=${venueLat}%2C${venueLng}`}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-soft">
            Map pin will appear here once the exact venue location is confirmed.
          </p>
        )}
      </Card>
    </div>
  );
}
