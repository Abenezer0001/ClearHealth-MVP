import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const principles = [
  "Stagger content reveal to guide reading of analysis evidence.",
  "Use soft hover lift only on interactive cards.",
  "Reserve continuous animation for ambient/status only.",
  "Target short timings (180ms to 450ms) for interface transitions.",
] as const;

export default function MotionPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <section className="section-shell">
        <h1 className="text-3xl md:text-4xl font-semibold">Motion Guide</h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          Animation should improve comprehension of medical analysis states, never compete with the content.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {principles.map((rule, index) => (
          <motion.article
            key={rule}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="section-shell text-sm text-muted-foreground"
          >
            {rule}
          </motion.article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <Card className="surface-panel">
            <CardHeader><CardTitle>Hover elevation pattern</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Use this for list rows and drill-down cards.
            </CardContent>
          </Card>
        </motion.div>

        <Card className="surface-panel">
          <CardHeader><CardTitle>Ambient signal pattern</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <motion.span
              className="inline-block h-3.5 w-3.5 rounded-full bg-emerald-400"
              animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-sm text-muted-foreground">Use for running/active analysis indicators.</span>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
