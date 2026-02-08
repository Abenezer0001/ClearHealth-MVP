import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getPreAuthRole } from "@/lib/pre-auth-role";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SignUpFormProps = {
  onSwitchToSignIn: () => void;
};

export default function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && email.trim().length > 0 && password.length >= 8;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    const selectedRole = getPreAuthRole();
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: "Choose a role first",
        description: "Select Patient or Coordinator before creating an account.",
      });
      setLocation("/role-selection");
      return;
    }

    setIsSubmitting(true);
    await authClient.signUp.email(
      {
        name: name.trim(),
        email: email.trim(),
        password,
      },
      {
        onSuccess: async () => {
          toast({
            title: "Account created",
            description: "Your account is ready. You are now signed in.",
          });
          // Role sync now happens centrally in App after auth/session settles.
          setLocation("/");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Sign up failed",
            description: error.error.message || error.error.statusText || "Unable to create account.",
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
          <UserPlus className="h-5 w-5" />
          Create Account
        </CardTitle>
        <CardDescription>Sign up to access TrialAtlas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sign-up-name">Full name</Label>
            <Input
              id="sign-up-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              minLength={2}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-up-email">Email</Label>
            <Input
              id="sign-up-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-up-password">Password</Label>
            <Input
              id="sign-up-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
        <Button variant="ghost" className="mt-4 w-full underline-offset-2 hover:underline" onClick={onSwitchToSignIn}>
          Already have an account? Sign in
        </Button>
        <Button variant="ghost" className="mt-1 w-full underline-offset-2 hover:underline" onClick={() => setLocation("/role-selection")}>
          {selectedRole ? `Change role (currently ${selectedRole})` : "Choose role"}
        </Button>
      </CardContent>
    </Card>
  );
}
