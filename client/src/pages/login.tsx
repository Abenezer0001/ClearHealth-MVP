import { useState } from "react";
import { useLocation } from "wouter";
import { Stethoscope } from "lucide-react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { getPreAuthRole } from "@/lib/pre-auth-role";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [showSignIn, setShowSignIn] = useState(true);
  const preAuthRole = getPreAuthRole();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with back navigation */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight hidden sm:inline">
              TrialAtlas
            </span>
          </button>
          {preAuthRole && (
            <p className="text-sm text-muted-foreground">
              Signing in as{" "}
              <span className="font-medium text-foreground capitalize">
                {preAuthRole}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="flex items-center justify-center p-6 pt-12">
        <div className="w-full max-w-md">
          {showSignIn ? (
            <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
