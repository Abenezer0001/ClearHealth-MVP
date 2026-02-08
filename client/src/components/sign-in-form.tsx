import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getPreAuthRole } from "@/lib/pre-auth-role";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SignInFormProps = {
  onSwitchToSignUp: () => void;
};

export default function SignInForm({ onSwitchToSignUp }: SignInFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 8;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    const selectedRole = getPreAuthRole();
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: "Choose a role first",
        description: "Select Patient or Coordinator before signing in.",
      });
      setLocation("/role-selection");
      return;
    }

    setIsSubmitting(true);
    await authClient.signIn.email(
      {
        email: email.trim(),
        password,
      },
      {
        onSuccess: async () => {
          toast({
            title: "Signed in",
            description: "Welcome back to TrialAtlas.",
          });
          // Role sync now happens centrally in App after auth/session settles.
          setLocation("/");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description:
              error.error.message || error.error.statusText || "Unable to sign in with those credentials.",
          });
        },
      },
    );
    setIsSubmitting(false);
  };

  const selectedRole = getPreAuthRole();

  return (
    <Card className="surface-panel w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          Sign In
        </CardTitle>
        <CardDescription>Use your account to access trial search and admin tools.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sign-in-email">Email</Label>
            <Input
              id="sign-in-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-in-password">Password</Label>
            <Input
              id="sign-in-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
        <Button variant="ghost" className="mt-4 w-full underline-offset-2 hover:underline" onClick={onSwitchToSignUp}>
          Need an account? Create one
        </Button>
        <Button variant="ghost" className="mt-1 w-full underline-offset-2 hover:underline" onClick={() => setLocation("/role-selection")}>
          {selectedRole ? `Change role (currently ${selectedRole})` : "Choose role"}
        </Button>
      </CardContent>
    </Card>
  );
}
