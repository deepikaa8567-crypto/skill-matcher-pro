import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Briefcase, FileText, Gauge, Plus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScorePill } from "@/components/score";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — SkillMatch AI" },
      { name: "description", content: "Screening overview: job descriptions, resumes screened and average match score." },
      { property: "og:title", content: "Overview — SkillMatch AI" },
      { property: "og:description", content: "Screening overview: job descriptions, resumes screened and average match score." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [jobs, candidates, matches] = await Promise.all([
        supabase.from("job_descriptions").select("id, title, company, created_at").order("created_at", { ascending: false }),
        supabase.from("candidates").select("id, full_name, status, created_at, job_description_id").order("created_at", { ascending: false }).limit(8),
        supabase.from("match_results").select("overall_score, created_at"),
      ]);
      const scores = (matches.data ?? []).map((m) => Number(m.overall_score));
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const weekScores = (matches.data ?? [])
        .filter((m) => new Date(m.created_at).getTime() > weekAgo)
        .map((m) => Number(m.overall_score));
      return {
        jobs: jobs.data ?? [],
        candidates: candidates.data ?? [],
        totalScreened: scores.length,
        avgWeek: weekScores.length
          ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length)
          : 0,
      };
    },
  });

  const stats = [
    { label: "Job descriptions", value: data?.jobs.length ?? 0, icon: Briefcase },
    { label: "Resumes screened", value: data?.totalScreened ?? 0, icon: FileText },
    { label: "Avg score this week", value: data?.avgWeek ?? 0, icon: Gauge, isScore: true },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Screening overview"
        description="Your AI first-pass across every open role."
        action={
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="size-4" /> New job description
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            whileHover={{ scale: 1.02 }}
            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className="size-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : stat.isScore ? (
              <div className="mt-3">
                <ScorePill score={stat.value} />
              </div>
            ) : (
              <p className="mt-2 text-3xl font-semibold tabular-nums">{stat.value}</p>
            )}
          </motion.div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent activity</h2>
        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (data?.candidates.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No resumes screened yet. Create a job description, then upload a batch of resumes.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.candidates.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="truncate font-medium">{c.full_name ?? "Processing resume…"}</span>
                  <Link
                    to="/jobs/$jobId"
                    params={{ jobId: c.job_description_id }}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    View role
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
