import { FloralDivider, Sprig } from "@/components/ui/Botanical";

/** Soft banner at the top of listing pages. */
export function PageHero({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-secondary/30 via-page to-accent/20">
      <Sprig className="pointer-events-none absolute -bottom-4 start-2 h-40 w-20 rotate-12 text-primary opacity-[0.12] sm:h-56 sm:w-28" />
      <Sprig className="pointer-events-none absolute -top-4 end-2 h-40 w-20 -rotate-[165deg] text-primary opacity-[0.12] sm:h-56 sm:w-28" />
      <div className="container-page relative py-10 text-center sm:py-14">
        {eyebrow && <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.25em] text-accent">{eyebrow}</p>}
        <h1 className="text-balance !text-4xl sm:!text-5xl">{title}</h1>
        <FloralDivider className="mt-3" />
        {text && <p className="mx-auto mt-3 max-w-xl text-ink/75">{text}</p>}
      </div>
    </section>
  );
}
