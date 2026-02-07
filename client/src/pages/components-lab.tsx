import { BackgroundBeams } from "@/components/ui/background-beams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Layers3, Sparkles, SwatchBook } from "lucide-react";

const lanes = [
  {
    title: "shadcn base",
    body: "Preserve accessibility and predictability for forms/tables used by the analysis workflow.",
    icon: Layers3,
  },
  {
    title: "Aceternity registry",
    body: "Use it for hero/background and high-impact visual sections without rewriting primitives.",
    icon: Sparkles,
  },
  {
    title: "21st MCP",
    body: "Use AI-assisted component generation when building new non-core surfaces quickly.",
    icon: Bot,
  },
] as const;

export default function ComponentsLabPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <section className="section-shell">
        <h1 className="text-3xl md:text-4xl font-semibold">Component Lab</h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          The business logic remains untouched. This page is the visual playground for reusable UI modules.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {lanes.map((lane) => (
          <Card key={lane.title} className="surface-panel">
            <CardHeader>
              <lane.icon className="h-5 w-5 text-primary" />
              <CardTitle className="capitalize mt-2">{lane.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{lane.body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Action hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button className="rounded-full px-6">Primary action</Button>
            <Button variant="secondary" className="rounded-full px-6">Secondary</Button>
            <Button variant="outline" className="rounded-full px-6">Quiet</Button>
          </CardContent>
        </Card>

        <Card className="surface-panel relative overflow-hidden min-h-60">
          <BackgroundBeams className="opacity-40" />
          <CardHeader className="relative z-10">
            <CardTitle>Aceternity component wired</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-sm text-muted-foreground max-w-xl">
              This app has `@aceternity/background-beams` installed and available in `client/src/components/ui`.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
              <SwatchBook className="h-3.5 w-3.5" />
              registry: @aceternity/background-beams
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
