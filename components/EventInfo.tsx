import { ChevronDown, MapPin } from "lucide-react";
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
    <div className="space-y-6">
      {faq.length > 0 && (
        <Card className="p-5 sm:p-6 bg-surface-2 border-line">
          <h2 className="mb-5 text-xl font-semibold text-ink-900">Frequently asked</h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <details key={i} className="group rounded-xl border border-line bg-surface/50 p-4 transition-all duration-200 open:bg-surface open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium text-ink-900 marker:hidden outline-none">
                  <span className="pr-4">{item.q}</span>
                  <ChevronDown className="h-5 w-5 text-ink-soft transition-transform duration-200 group-open:rotate-180 flex-shrink-0" />
                </summary>
                <div className="mt-3 border-t border-line/60 pt-3 text-[14px] leading-relaxed text-ink-700">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
      <Card className="p-5 sm:p-6 bg-surface-2 border-line">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-ink-900">Venue</h2>
        </div>
        <p className="mb-4 text-[15px] text-ink-700">{venueName ?? "To be confirmed"}</p>
        {hasPin ? (
          <iframe
            title="Venue location"
            className="h-64 w-full rounded-xl border border-line shadow-sm"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${venueLng! - 0.01}%2C${
              venueLat! - 0.01
            }%2C${venueLng! + 0.01}%2C${venueLat! + 0.01}&layer=mapnik&marker=${venueLat}%2C${venueLng}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line py-10 bg-surface/50">
            <MapPin className="h-8 w-8 text-ink-soft/40 mb-2" />
            <p className="text-center text-sm text-ink-soft">
              Map pin will appear here once the exact venue location is confirmed.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
