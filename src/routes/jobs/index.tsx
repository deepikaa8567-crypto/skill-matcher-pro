import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Plus, Users } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Job descriptions — SkillMatch AI" },
      { name: "description", content: "All roles you are screening for, with parsed requirements and candidate counts." },
      { property: "og:title", content: "Job descriptions — SkillMatch AI" },
      { property: "og:description", content: "All roles you are screening for, with parsed requirements and candidate counts." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data: jobs, error } = await supabase
        .from("job_descriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: candidates } = await supabase.from("candidates").select("id, job_description_id");
      const counts = new Map<string, number>();
      for (const c of candidates ?? []) {
        counts.set(c.job_description_id, (counts.get(c.job_description_id) ?? 0) + 1);
      }
      return (jobs ?? []).map((j) => ({ ...j, candidateCount: counts.get(j.id) ?? 0 }));
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Job descriptions"
        description="Each role holds its own candidate pool and ranked shortlist."
        action={
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="size-4" /> New job description
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-14 text-center">
          <h2 className="text-lg font-medium">No job descriptions yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Paste or upload a JD and SkillMatch AI will extract the required skills, experience and
            education so every resume is scored against the same rubric.
          </p>
          <Button asChild className="mt-6">
            <Link to="/jobs/new">
              <Plus className="size-4" /> Create your first JD
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data!.map((job, i) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="block h-full rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{job.title}</h3>
                    {job.company ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{job.company}</p>
                    ) : null}
                  </div>
                  {job.parse_status !== "parsed" ? (
                    <Badge variant="secondary" className="capitalize">
                      {job.parse_status}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {job.required_skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                    >
                      {s}
                    </span>
                  ))}
                  {job.required_skills.length > 4 ? (
                    <span className="px-1 py-1 text-xs text-muted-foreground">
                      +{job.required_skills.length - 4}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {job.candidateCount} candidate
                  {job.candidateCount === 1 ? "" : "s"}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
