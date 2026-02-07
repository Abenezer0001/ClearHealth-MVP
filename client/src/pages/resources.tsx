import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const resources = [
  {
    title: "Inspiration",
    links: [
      ["Layers", "https://layers.to/"],
      ["Mobbin", "https://mobbin.com/"],
      ["Dribbble", "https://dribbble.com/"],
    ],
  },
  {
    title: "Component libraries",
    links: [
      ["21st.dev", "https://21st.dev/"],
      ["Aceternity UI", "https://ui.aceternity.com/"],
      ["Magic UI", "https://magicui.design/"],
    ],
  },
  {
    title: "Motion",
    links: [
      ["Rive", "https://rive.app/"],
      ["Anime.js", "https://animejs.com/"],
      ["Motion Primitives", "https://motion-primitives.com/"],
    ],
  },
  {
    title: "Icons",
    links: [
      ["Lucide Animated", "https://lucide-animated.com/"],
      ["Iconsax", "https://iconsax.dev/"],
      ["Nucleo", "https://nucleoapp.com/"],
    ],
  },
] as const;

export default function ResourcesPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <section className="section-shell">
        <h1 className="text-3xl md:text-4xl font-semibold">Design Resource Index</h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          Reference list based on NaironAI design directory categories for ongoing UI iteration.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {resources.map((group) => (
          <Card key={group.title} className="surface-panel">
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg border border-border/70 bg-background/65 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
