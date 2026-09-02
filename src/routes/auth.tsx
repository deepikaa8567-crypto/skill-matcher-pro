import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, ScanSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAccount } from "@/lib/demo.functions";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SkillMatch AI" },
      { name: "description", content: "Recruiter sign in for the SkillMatch AI resume screening workspace." },
      { property: "og:title", content: "Sign in — SkillMatch AI" },
      { property: "og:description", content: "Recruiter sign in for the SkillMatch AI resume screening workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const prepareDemo = useServerFn(ensureDemoAccount);

  const demoLogin = async () => {
    setDemoBusy(true);
    try {
      const creds = await prepareDemo({ data: undefined });
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) throw error;
      toast.success("Signed in to the demo workspace");
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setDemoBusy(false);
    }
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        router.navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created — you can sign in now");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ScanSearch className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">SkillMatch AI</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to your screening workspace" : "Create your recruiter account"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruiter@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void demoLogin()}
          disabled={demoBusy || busy}
        >
          {demoBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Try the demo (no signup)
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Instant access to a workspace preloaded with sample roles and candidates.
        </p>


        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}
