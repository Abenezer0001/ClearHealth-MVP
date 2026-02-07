import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tokens = [
  { token: "--background", use: "Primary canvas and viewport gradients" },
  { token: "--card", use: "Surface panels across all workflows" },
  { token: "--primary", use: "Primary CTA and active indicators" },
  { token: "--accent", use: "Secondary callouts and chips" },
  { token: "--muted", use: "Low-emphasis containers and helper rows" },
  { token: "--destructive", use: "Critical health-risk warnings" },
] as const;

const constraints = [
  "Reuse token variables instead of ad-hoc colors.",
  "One primary CTA per section.",
  "Keep spacing generous on content-heavy medical analysis views.",
  "Animations should support hierarchy, not distract from claims evidence.",
] as const;

export default function DesignSystemPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <section className="section-shell">
        <h1 className="text-3xl md:text-4xl font-semibold">ClearHealth Design System</h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          This project keeps the existing health-misinformation business logic and replaces the visual system with a curated, component-driven setup aligned to the NaironAI design workflow.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Token map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tokens.map((item) => (
              <div key={item.token} className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <code className="text-primary text-sm font-semibold">{item.token}</code>
                <span className="text-sm text-muted-foreground">{item.use}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Implementation constraints</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {constraints.map((rule) => (
                <li key={rule} className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  {rule}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
