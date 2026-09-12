import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScorePill } from "@/components/score";
import { ResumeDropzone } from "@/components/resume-dropzone";
import { CandidateDetail } from "@/components/candidate-detail";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCandidate, parseJobDescription } from "@/lib/screening.functions";
import type { CandidateRow, EducationItem, ExperienceItem } from "@/lib/candidate-types";

export const Route = createFileRoute("/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Ranked candidates — SkillMatch AI" },
      { name: "description", content: "Ranked, explainable shortlist of candidates screened against this job description." },
      { property: "og:title", content: "Ranked candidates — SkillMatch AI" },
      { property: "og:description", content: "Ranked, explainable shortlist of candidates screened against this job description." },
    ],
  }),
  component: JobDetailPage,
});

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-accent text-accent-foreground animate-pulse",
  analyzed: "bg-muted text-muted-foreground",
  shortlisted: "bg-[color-mix(in_oklch,var(--color-success),transparent_85%)] text-[color:var(--color-success)]",
  rejected: "bg-[color-mix(in_oklch,var(--color-destructive),transparent_88%)] text-destructive",
  failed: "bg-[color-mix(in_oklch,var(--color-destructive),transparent_88%)] text-destructive",
};

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeCandidate);
  const parseJd = useServerFn(parseJobDescription);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_descriptions")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const candidatesQuery = useQuery({
    queryKey: ["candidates", jobId],
    refetchInterval: (q) =>
      (q.state.data ?? []).some((c) => c.status === "processing" || c.status === "pending")
        ? 3000
        : false,
    queryFn: async (): Promise<CandidateRow[]> => {
      const [{ data: candidates, error }, { data: matches }] = await Promise.all([
        supabase
          .from("candidates")
          .select("*")
          .eq("job_description_id", jobId)
          .order("created_at", { ascending: false }),
        supabase.from("match_results").select("*").eq("job_description_id", jobId),
      ]);
      if (error) throw error;
      const byCandidate = new Map((matches ?? []).map((m) => [m.candidate_id, m]));
      return (candidates ?? []).map((c) => ({
        ...c,
        parsed_experience: (c.parsed_experience as ExperienceItem[] | null) ?? [],
        parsed_education: (c.parsed_education as EducationItem[] | null) ?? [],
        match: byCandidate.get(c.id) ?? null,
      }));
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["candidates", jobId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const setStatus = async (id: string, status: "shortlisted" | "rejected") => {
    const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "shortlisted" ? "Candidate shortlisted" : "Candidate rejected");
    refresh();
  };

  const reanalyze = async (id: string) => {
    toast.info("Re-analyzing candidate…");
    refresh();
    try {
      await analyze({ data: { candidateId: id, reparse: true } });
      toast.success("Analysis updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-analysis failed");
    }
    refresh();
  };

  const rows = useMemo(() => {
    let list = candidatesQuery.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.full_name ?? c.file_name ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (scoreFilter !== "all") {
      list = list.filter((c) => {
        const s = Number(c.match?.overall_score ?? -1);
        if (scoreFilter === "high") return s >= 75;
        if (scoreFilter === "mid") return s >= 50 && s < 75;
        return s >= 0 && s < 50;
      });
    }
    return [...list].sort((a, b) => {
      const sa = Number(a.match?.overall_score ?? -1);
      const sb = Number(b.match?.overall_score ?? -1);
      return sortAsc ? sa - sb : sb - sa;
    });
  }, [candidatesQuery.data, search, statusFilter, scoreFilter, sortAsc]);

  const selected = rows.find((c) => c.id === selectedId) ?? null;
  const job = jobQuery.data;

  return (
    <AppShell>
      <PageHeader
        title={job?.title ?? "Job description"}
        description={job?.company ?? ""}
        action={
          <Button
            variant="outline"
            onClick={async () => {
              toast.info("Re-extracting requirements…");
              try {
                await parseJd({ data: { jobDescriptionId: jobId } });
                await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
                toast.success("Requirements updated");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Parsing failed");
              }
            }}
          >
            <RefreshCw className="size-4" /> Re-parse JD
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-semibold">Parsed requirements</h2>
            {jobQuery.isLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="mt-3 space-y-4 text-sm">
                {job?.role_summary ? (
                  <p className="leading-relaxed text-muted-foreground">{job.role_summary}</p>
                ) : null}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Required skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(job?.required_skills ?? []).map((s) => (
                      <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                        {s}
                      </span>
                    ))}
                    {(job?.required_skills ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">Not extracted yet</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Nice to have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(job?.preferred_skills ?? []).map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {job?.min_experience_years ? `${job.min_experience_years}+ years` : "No minimum experience"}
                  {" · "}
                  {job?.education_requirement ?? "No education requirement"}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 text-sm font-semibold">Upload resumes</h2>
            <ResumeDropzone jobId={jobId} onDone={refresh} />
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates"
                className="pl-9"
              />
            </div>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scores</SelectItem>
                <SelectItem value="high">High (75+)</SelectItem>
                <SelectItem value="mid">Medium (50–74)</SelectItem>
                <SelectItem value="low">Low (&lt;50)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="analyzed">Analyzed</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSortAsc((v) => !v)}>
              {sortAsc ? "Lowest first" : "Highest first"}
            </Button>
          </div>

          {candidatesQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-14 text-center">
              <h3 className="text-lg font-medium">No candidates to show</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Upload a batch of resumes and each one is parsed, scored and ranked against this role.
              </p>
            </div>
          ) : (
            <motion.ul layout className="space-y-3">
              <AnimatePresence initial={false}>
                {rows.map((c, i) => {
                  const score = Number(c.match?.overall_score ?? 0);
                  return (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.04, 0.4) } }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      whileHover={{ scale: 1.01 }}
                      className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {c.match?.rank ? (
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                            #{c.match.rank}
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.full_name ?? c.file_name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {(c.match?.matched_skills ?? []).slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{
                                  color: "var(--color-success)",
                                  backgroundColor:
                                    "color-mix(in oklch, var(--color-success), transparent 88%)",
                                }}
                              >
                                {s}
                              </span>
                            ))}
                            <Badge className={statusStyles[c.status] ?? ""} variant="secondary">
                              {c.status === "processing" ? "analyzing…" : c.status}
                            </Badge>
                          </div>
                          {c.status === "failed" && c.error_message ? (
                            <p className="mt-1.5 text-xs text-destructive">{c.error_message}</p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {c.match ? <ScorePill score={score} /> : null}
                          {c.status === "failed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                void reanalyze(c.id);
                              }}
                            >
                              <RefreshCw className="size-4" /> Retry
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Shortlist"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void setStatus(c.id, "shortlisted");
                                }}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Reject"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void setStatus(c.id, "rejected");
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </motion.ul>
          )}
        </section>
      </div>

      <CandidateDetail
        candidate={selected}
        jd={job ?? null}
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onStatus={(id, status) => void setStatus(id, status)}
        onReanalyze={(id) => void reanalyze(id)}
      />
    </AppShell>
  );
}
