import { motion } from "motion/react";
import { Check, RefreshCw, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreBar, ScoreRing } from "@/components/score";
import type { CandidateRow } from "@/lib/candidate-types";

export function CandidateDetail({
  candidate,
  jd,
  open,
  onOpenChange,
  onStatus,
  onReanalyze,
}: {
  candidate: CandidateRow | null;
  jd: { required_skills: string[]; preferred_skills: string[]; min_experience_years: number | null; education_requirement: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatus: (id: string, status: "shortlisted" | "rejected") => void;
  onReanalyze: (id: string) => void;
}) {
  const match = candidate?.match;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {candidate ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{candidate.full_name ?? "Unnamed candidate"}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {[candidate.email, candidate.phone].filter(Boolean).join(" · ") || candidate.file_name}
              </p>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {match ? (
                <div className="flex items-center gap-6 rounded-xl border border-border bg-card p-4">
                  <ScoreRing score={Number(match.overall_score)} />
                  <div className="flex-1 space-y-3">
                    <ScoreBar label="Keyword overlap (40%)" score={Number(match.keyword_score ?? 0)} />
                    <ScoreBar label="Semantic fit (60%)" score={Number(match.semantic_score ?? 0)} />
                  </div>
                </div>
              ) : null}

              {match?.ai_summary ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">AI rationale</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{match.ai_summary}</p>
                  {match.strengths ? (
                    <div className="rounded-lg border border-border bg-[color-mix(in_oklch,var(--color-success),transparent_92%)] p-3 text-sm">
                      <span className="font-medium">Strength: </span>
                      {match.strengths}
                    </div>
                  ) : null}
                  {match.concerns ? (
                    <div className="rounded-lg border border-border bg-[color-mix(in_oklch,var(--color-warning),transparent_92%)] p-3 text-sm">
                      <span className="font-medium">Concern: </span>
                      {match.concerns}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Matched skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(match?.matched_skills ?? []).map((s, i) => (
                      <motion.span
                        key={s}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          color: "var(--color-success)",
                          backgroundColor: "color-mix(in oklch, var(--color-success), transparent 88%)",
                        }}
                      >
                        {s}
                      </motion.span>
                    ))}
                    {(match?.matched_skills ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">None recorded</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Missing skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(match?.missing_skills ?? []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          color: "var(--color-warning)",
                          backgroundColor: "color-mix(in oklch, var(--color-warning), transparent 85%)",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                    {(match?.missing_skills ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nothing missing</span>
                    ) : null}
                  </div>
                </div>
              </section>

              <Separator />

              <section className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Candidate profile</h3>
                  <p className="text-sm text-muted-foreground">
                    {candidate.total_experience_years ?? "—"} yrs experience
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {candidate.parsed_skills.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Role requirements</h3>
                  <p className="text-sm text-muted-foreground">
                    {jd?.min_experience_years ? `${jd.min_experience_years}+ yrs` : "No minimum"} ·{" "}
                    {jd?.education_requirement ?? "No education requirement"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(jd?.required_skills ?? []).map((s) => (
                      <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Experience</h3>
                {(candidate.parsed_experience ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No experience parsed.</p>
                ) : (
                  <ul className="space-y-3">
                    {(candidate.parsed_experience ?? []).map((exp, i) => (
                      <li key={i} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium">
                          {exp.role ?? "Role"} {exp.company ? `· ${exp.company}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{exp.duration}</p>
                        {exp.description ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {exp.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Education</h3>
                {(candidate.parsed_education ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No education parsed.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {(candidate.parsed_education ?? []).map((ed, i) => (
                      <li key={i}>
                        {[ed.degree, ed.institution, ed.year].filter(Boolean).join(" · ")}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background/90 py-3 backdrop-blur">
                <Button
                  className="flex-1"
                  onClick={() => onStatus(candidate.id, "shortlisted")}
                  disabled={candidate.status === "shortlisted"}
                >
                  <Check className="size-4" /> Shortlist
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onStatus(candidate.id, "rejected")}
                  disabled={candidate.status === "rejected"}
                >
                  <X className="size-4" /> Reject
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onReanalyze(candidate.id)} aria-label="Re-analyze">
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
