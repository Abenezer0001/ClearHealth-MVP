import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getPreAuthRole, resolveAuthEntryPath, type AuthEntryIntent } from "@/lib/pre-auth-role";
import {
  ArrowRight,
  CircleCheck,
  ClipboardList,
  Compass,
  DatabaseZap,
  HeartHandshake,
  Search,
  Send,
  Stethoscope,
} from "lucide-react";

type SharePreviewKey = "demographics" | "conditions" | "labs" | "medications" | "location" | "email";
type SharePreviewField = {
  key: SharePreviewKey;
  label: string;
  help: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

const sharePreviewFields: SharePreviewField[] = [
  { key: "demographics", label: "Demographics", help: "Age + sex" },
  { key: "conditions", label: "Conditions", help: "Diagnosis summary" },
  { key: "labs", label: "Lab results", help: "Recent values (optional)" },
  { key: "medications", label: "Medications", help: "Active meds (optional)" },
  { key: "location", label: "Location", help: "City / region (optional)" },
  { key: "email", label: "Email", help: "Contact email" },
];

const faqItems: FaqItem[] = [
  {
    question: "What is TrialAtlas?",
    answer:
      "TrialAtlas is a clinical-trial discovery and lead-routing platform where patients can find studies and coordinators can manage inbound interest.",
  },
  {
    question: "Who is TrialAtlas for?",
    answer:
      "It serves two audiences: patients searching for trial options, and coordinators/physicians/research staff recruiting and managing trial leads.",
  },
  {
    question: "Do I choose a role before login or register?",
    answer:
      "Yes. TrialAtlas routes through role selection first, then continues to role-aware login or register.",
  },
  {
    question: "What can patients share when expressing interest?",
    answer:
      "The live flow allows selecting fields before submit. Demographics, conditions, and email are preselected; labs, medications, and location are optional.",
  },
  {
    question: "Can coordinators update lead progress?",
    answer:
      "Yes. Coordinator inbox supports New, Contacted, Scheduled, and Not a Fit statuses plus notes on each lead.",
  },
  {
    question: "Can coordinators and physicians recruit patients through this workflow?",
    answer:
      "Yes. TrialAtlas supports recruitment workflow by collecting patient-submitted interest and routing it into coordinator inbox for triage and follow-up.",
  },
  {
    question: "Where do trial listings come from?",
    answer:
      "Trial search is powered by ClinicalTrials.gov via the app backend and can be filtered by condition, phase, status, and location.",
  },
];

function useReveal(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(56px) scale(0.94)",
        transition: "opacity 900ms cubic-bezier(0.22, 1, 0.36, 1), transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [sharePreview, setSharePreview] = useState<Record<SharePreviewKey, boolean>>({
    demographics: true,
    conditions: true,
    labs: false,
    medications: false,
    location: false,
    email: true,
  });

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      setScrollY(window.scrollY);
      if (maxScroll <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress((window.scrollY / maxScroll) * 100);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const enabledShareCount = useMemo(
    () => Object.values(sharePreview).filter(Boolean).length,
    [sharePreview],
  );

  const onAuthIntent = (intent: AuthEntryIntent) => {
    const selectedRole = getPreAuthRole();
    setLocation(resolveAuthEntryPath(intent, selectedRole));
  };

  const heroParallax = Math.max(-56, -scrollY * 0.08);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute left-[-10%] top-[-18%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-xl" />
        <div className="absolute bottom-[-26%] right-[-12%] h-[34rem] w-[34rem] rounded-full bg-accent/20 blur-xl" />
      </div>

      <div className="fixed left-0 right-0 top-0 z-[70] h-1 bg-border/60">
        <div
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <nav className="fixed left-0 right-0 top-1 z-50 border-b border-border/80 bg-background/76 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-xl font-semibold leading-none">TrialAtlas</p>
              <p className="text-xs text-muted-foreground">Patient-centered trial discovery</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onAuthIntent("login")}>
              Login
            </Button>
            <Button onClick={() => onAuthIntent("register")}>
              Register
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="border-b border-border/60 bg-muted/20 px-6 pb-20 pt-32 md:pt-36">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-7">
            <Reveal>
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium">
                <HeartHandshake className="mr-1.5 h-3.5 w-3.5" />
                Real workflow over marketing claims
              </Badge>
            </Reveal>

            <Reveal delay={60}>
              <h1 className="text-balance text-4xl font-semibold leading-tight md:text-6xl">
                Find clinical trials with{" "}
                <span className="text-primary">care, clarity, and real next steps</span>.
              </h1>
            </Reveal>

            <Reveal delay={120}>
              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                TrialAtlas uses AI-assisted matching to help patients find relevant studies with less manual searching.
                Connect via SMART on FHIR, then share only the fields you choose when expressing interest.
              </p>
            </Reveal>

            <Reveal delay={180}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="px-8 text-base" onClick={() => onAuthIntent("register")}>
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 text-base"
                  onClick={() => document.getElementById("grounded-capabilities")?.scrollIntoView({ behavior: "smooth" })}
                >
                  See what is live now
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={140} className="relative">
            <div
              className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-2xl shadow-primary/10"
              style={{ transform: `translateY(${heroParallax}px)` }}
            >
              <div className="pointer-events-none absolute inset-0 bg-primary/5" />
              <div className="relative space-y-4 p-6 md:p-8">
                <div className="overflow-hidden rounded-2xl border border-border/75">
                  <img
                    src="/hero-collaboration.png"
                    alt="Care coordinator speaking with a patient"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-background/90 p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Patient flow</p>
                    <p className="font-semibold">Connect record, go to Find Trials, then submit interest with selected fields.</p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/90 p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Coordinator flow</p>
                    <p className="font-semibold">Review lead, update status, and keep notes in inbox.</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="grounded-capabilities"
        className="border-y border-primary/50 bg-primary px-6 py-14 text-primary-foreground"
      >
        <div className="mx-auto max-w-7xl space-y-8">
          <Reveal>
            <h2 className="text-3xl font-semibold md:text-4xl">What exists in the app today</h2>
            <p className="mt-2 text-lg text-primary-foreground/85">
              No promises beyond shipped flows.
            </p>
          </Reveal>
          <div className="grid overflow-hidden rounded-2xl border border-white/45 bg-white/95 text-slate-900 lg:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Trial search + matching",
                body: "Patients can search by condition/location/status/phase, and AI-matched trial cards appear after SMART on FHIR connection.",
                where: "Found on / (Trials page)",
              },
              {
                icon: Send,
                title: "Share-interest controls",
                body: "From a trial card, patients open “Express Interest” and choose which fields to share before submission.",
                where: "ShareInterestDialog in trial flow",
              },
              {
                icon: ClipboardList,
                title: "Coordinator lead workflow",
                body: "Inbox supports status transitions and notes for each lead using patient-approved shared fields.",
                where: "Found on /coordinator-inbox",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div
                  className={`h-full p-7 ${index > 0 ? "border-t border-slate-200 lg:border-t-0" : ""} ${index < 2 ? "lg:border-r lg:border-slate-200" : ""
                    }`}
                >
                  <item.icon className="mb-4 h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-slate-600">{item.body}</p>
                  <p className="mt-4 text-sm font-medium text-slate-900">{item.where}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-muted/35 px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <Reveal>
            <div className="h-full border-l-4 border-primary pl-6">
              <div className="mb-4 flex items-center gap-2">
                <DatabaseZap className="h-5 w-5 text-primary" />
                <p className="text-sm uppercase tracking-wide text-muted-foreground">Live Share-Interest Model</p>
              </div>
              <h3 className="text-2xl font-semibold">Field controls used in the actual submit flow</h3>
              <p className="mt-3 text-muted-foreground">
                This mirrors the current “Express Interest” interaction. Patients can toggle fields before data is sent.
              </p>
              <div className="mt-6 border border-border/80 bg-background/65 p-4 text-sm">
                <p>
                  Selected now: <strong>{enabledShareCount}</strong> fields
                </p>
                <p className="mt-1 text-muted-foreground">
                  Demographics, conditions, and email are preselected in the current dialog.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <div className="space-y-3 border border-border/80 bg-card/92 p-6">
              {sharePreviewFields.map((field) => {
                const enabled = sharePreview[field.key];

                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() =>
                      setSharePreview((previous) => ({
                        ...previous,
                        [field.key]: !previous[field.key],
                      }))
                    }
                    className={`w-full border p-3 text-left transition ${enabled
                      ? "border-primary/60 bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border/80 bg-background/68 hover:border-primary/45"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        <p className="text-sm text-muted-foreground">{field.help}</p>
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${enabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          }`}
                      >
                        {enabled ? <CircleCheck className="h-3.5 w-3.5" /> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-primary/50 bg-primary px-6 py-16 text-primary-foreground">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Compass className="h-5 w-5" />
                <h2 className="text-2xl font-semibold md:text-3xl">Coordinator statuses currently supported</h2>
              </div>
              <div className="relative mt-8">
                <div className="absolute left-0 right-0 top-4 hidden h-px bg-white/40 lg:block" />
                <div className="grid gap-8 text-sm lg:grid-cols-4">
                  {[
                    { step: "1", title: "New", copy: "Patient just submitted interest." },
                    { step: "2", title: "Contacted", copy: "Coordinator reached out." },
                    { step: "3", title: "Scheduled", copy: "Screening call or visit set." },
                    { step: "4", title: "Not a Fit", copy: "Does not meet trial criteria." },
                  ].map((item) => (
                    <div key={item.step} className="relative">
                      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-primary text-sm font-semibold">
                        {item.step}
                      </div>
                      <p className="text-lg font-semibold">{item.title}</p>
                      <p className="mt-2 text-primary-foreground/85">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-8 text-sm text-primary-foreground/80">
                Notes can also be added per lead from the same inbox detail panel.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-muted/35 px-6 pb-16 pt-12">
        <div className="mx-auto grid max-w-7xl items-center gap-6 border-t border-border/70 py-6 lg:grid-cols-[1.4fr_auto]">
          <Reveal>
            <h2 className="text-3xl font-semibold md:text-4xl">Choose your path and get started</h2>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
              Whether you are looking for trials or managing recruitment, TrialAtlas guides you to the right experience from the first step.
            </p>
          </Reveal>
          <Reveal delay={90}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-white px-8 text-primary hover:bg-white/90" onClick={() => onAuthIntent("register")}>
                Register
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-white/90 px-8 text-primary hover:bg-white"
                onClick={() => onAuthIntent("login")}
              >
                Login
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-primary/10 px-6 pb-24 pt-12">
        <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">FAQ</h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Detailed answers for patients, coordinators, and physician-led recruiting teams.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="border border-border bg-card px-6 py-3 text-foreground">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={item.question} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-base text-slate-600">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
