import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPreAuthRole } from "@/lib/pre-auth-role";
import {
    Heart,
    ClipboardList,
    Shield,
    ArrowRight,
    Stethoscope,
    Users,
    Lock,
    CheckCircle2,
    Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Simple fade-in animation hook
function useFadeIn(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isVisible };
}

function FadeInSection({
    children,
    className = "",
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    const { ref, isVisible } = useFadeIn();

    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${className}`}
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(24px)",
                transitionDelay: `${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

export default function LandingPage() {
    const [, setLocation] = useLocation();

    const handleGetStarted = () => {
        const existingRole = getPreAuthRole();
        if (existingRole) {
            setLocation("/login");
        } else {
            setLocation("/role-selection");
        }
    };

    const handleLogin = () => {
        const existingRole = getPreAuthRole();
        if (existingRole) {
            setLocation("/login");
        } else {
            setLocation("/role-selection");
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                            <Stethoscope className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-serif text-xl font-semibold tracking-tight">
                            TrialAtlas
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={handleLogin}>
                            Sign In
                        </Button>
                        <Button onClick={handleGetStarted}>
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left: Content */}
                        <div className="space-y-8">
                            <FadeInSection>
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 text-accent-foreground text-sm font-medium">
                                    <Sparkles className="h-4 w-4" />
                                    Your journey to better health starts here
                                </div>
                            </FadeInSection>

                            <FadeInSection delay={100}>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
                                    Find the right{" "}
                                    <span className="text-primary">clinical trial</span> for your
                                    journey
                                </h1>
                            </FadeInSection>

                            <FadeInSection delay={200}>
                                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                                    We connect patients with life-changing clinical trials while
                                    giving you complete control over your health data. Your story
                                    matters—let's find the care you deserve.
                                </p>
                            </FadeInSection>

                            <FadeInSection delay={300}>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button size="lg" onClick={handleGetStarted} className="text-base px-8">
                                        Start Your Search
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        onClick={() => {
                                            document
                                                .getElementById("how-it-works")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="text-base px-8"
                                    >
                                        Learn How It Works
                                    </Button>
                                </div>
                            </FadeInSection>

                            <FadeInSection delay={400}>
                                <div className="flex items-center gap-6 pt-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Shield className="h-4 w-4 text-primary" />
                                        HIPAA Compliant
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Lock className="h-4 w-4 text-primary" />
                                        Your Data, Your Control
                                    </div>
                                </div>
                            </FadeInSection>
                        </div>

                        {/* Right: Hero Image */}
                        <FadeInSection delay={200} className="relative">
                            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                                <img
                                    src="/hero-collaboration.png"
                                    alt="A caring doctor having a supportive conversation with a patient"
                                    className="w-full h-auto object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
                            </div>
                            {/* Floating trust badge */}
                            <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl p-4 shadow-lg border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                                        <CheckCircle2 className="h-6 w-6 text-accent-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Trusted Platform</p>
                                        <p className="text-xs text-muted-foreground">
                                            Connected to 400,000+ trials
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </FadeInSection>
                    </div>
                </div>
            </section>

            {/* Value Proposition - Bento Grid */}
            <section className="py-20 px-6 bg-muted/30">
                <div className="max-w-7xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4">
                                Built for everyone in the clinical trial journey
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Whether you're seeking treatment options or managing patient
                                recruitment, TrialAtlas is designed with empathy at its core.
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* For Patients */}
                        <FadeInSection delay={100}>
                            <Card className="h-full overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                                <CardContent className="p-8">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 mb-6">
                                        <Heart className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-semibold mb-3">
                                        For Patients
                                    </h3>
                                    <p className="text-muted-foreground mb-6">
                                        Discover clinical trials that match your unique health
                                        profile. You're in control of what you share.
                                    </p>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Connect your health records</strong> securely
                                                via SMART on FHIR
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Search thousands of trials</strong> by
                                                condition, phase, and location
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Express interest privately</strong> and choose
                                                exactly what data to share
                                            </span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </FadeInSection>

                        {/* For Coordinators */}
                        <FadeInSection delay={200}>
                            <Card className="h-full overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                                <CardContent className="p-8">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-6">
                                        <ClipboardList className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-semibold mb-3">
                                        For Coordinators
                                    </h3>
                                    <p className="text-muted-foreground mb-6">
                                        Streamline patient recruitment with qualified leads who have
                                        already expressed genuine interest.
                                    </p>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Receive pre-screened leads</strong> from
                                                patients interested in your trials
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>View relevant health data</strong> shared with
                                                patient consent
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>
                                                <strong>Manage your pipeline</strong> from first contact
                                                to enrollment
                                            </span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </FadeInSection>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4">
                                How TrialAtlas Works
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Three simple steps to connect with the right clinical trial
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <FadeInSection delay={100}>
                            <div className="text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-6">
                                    1
                                </div>
                                <h3 className="text-xl font-semibold mb-3">Choose Your Role</h3>
                                <p className="text-muted-foreground">
                                    Tell us if you're a patient looking for trials or a
                                    coordinator managing recruitment. Your experience is tailored
                                    to your needs.
                                </p>
                            </div>
                        </FadeInSection>

                        {/* Step 2 */}
                        <FadeInSection delay={200}>
                            <div className="text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-6">
                                    2
                                </div>
                                <h3 className="text-xl font-semibold mb-3">
                                    Connect & Discover
                                </h3>
                                <p className="text-muted-foreground">
                                    Patients can securely link health records and search trials.
                                    Coordinators get a streamlined inbox of interested candidates.
                                </p>
                            </div>
                        </FadeInSection>

                        {/* Step 3 */}
                        <FadeInSection delay={300}>
                            <div className="text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-6">
                                    3
                                </div>
                                <h3 className="text-xl font-semibold mb-3">Take Action</h3>
                                <p className="text-muted-foreground">
                                    Express interest in trials with controlled data sharing, or
                                    manage leads through your recruitment workflow.
                                </p>
                            </div>
                        </FadeInSection>
                    </div>
                </div>
            </section>

            {/* Trust & Security */}
            <section className="py-20 px-6 bg-muted/30">
                <div className="max-w-7xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4">
                                Your Privacy is Our Priority
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                We built TrialAtlas with trust and transparency at its
                                foundation
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FadeInSection delay={100}>
                            <Card className="text-center p-6">
                                <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
                                <h4 className="font-semibold mb-2">HIPAA Compliant</h4>
                                <p className="text-sm text-muted-foreground">
                                    Your health data is protected by industry-leading security
                                    standards
                                </p>
                            </Card>
                        </FadeInSection>

                        <FadeInSection delay={150}>
                            <Card className="text-center p-6">
                                <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
                                <h4 className="font-semibold mb-2">You Control Your Data</h4>
                                <p className="text-sm text-muted-foreground">
                                    Choose exactly what information to share with each trial
                                    coordinator
                                </p>
                            </Card>
                        </FadeInSection>

                        <FadeInSection delay={200}>
                            <Card className="text-center p-6">
                                <Users className="h-10 w-10 text-primary mx-auto mb-4" />
                                <h4 className="font-semibold mb-2">SMART on FHIR</h4>
                                <p className="text-sm text-muted-foreground">
                                    Securely connect to your existing health records from major
                                    providers
                                </p>
                            </Card>
                        </FadeInSection>

                        <FadeInSection delay={250}>
                            <Card className="text-center p-6">
                                <Heart className="h-10 w-10 text-primary mx-auto mb-4" />
                                <h4 className="font-semibold mb-2">Built with Empathy</h4>
                                <p className="text-sm text-muted-foreground">
                                    Designed by healthcare advocates who understand your journey
                                </p>
                            </Card>
                        </FadeInSection>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <FadeInSection>
                        <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-6">
                            Ready to find the right trial for you?
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                            Join thousands of patients and coordinators who trust TrialAtlas
                            to navigate the world of clinical trials with confidence and care.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={handleGetStarted} className="text-base px-8">
                                Get Started Today
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button size="lg" variant="outline" onClick={handleLogin} className="text-base px-8">
                                Sign In to Your Account
                            </Button>
                        </div>
                    </FadeInSection>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border py-12 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                                <Stethoscope className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <span className="font-serif text-xl font-semibold tracking-tight">
                                TrialAtlas
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            © 2026 TrialAtlas. Empowering patients and coordinators together.
                        </p>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <a href="#" className="hover:text-foreground transition-colors">
                                Privacy Policy
                            </a>
                            <a href="#" className="hover:text-foreground transition-colors">
                                Terms of Service
                            </a>
                            <a href="#" className="hover:text-foreground transition-colors">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
