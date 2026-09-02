import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type ParsedJd = {
  role_summary: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience_years: number | null;
  education_requirement: string | null;
};

type ParsedResume = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: Array<{ degree?: string; institution?: string; year?: string }>;
  experience: Array<{ role?: string; company?: string; duration?: string; description?: string }>;
  total_experience_years: number | null;
};

type SemanticResult = {
  matched_skills: string[];
  missing_skills: string[];
  semantic_score: number;
  rationale: string;
  strength: string;
  concern: string;
};

const clamp = (n: unknown) => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/** Extract raw text from an uploaded file already in the `resumes` bucket. */
export const extractStorageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { extractDocumentText } = await import("./groq.server");
    const { data: file, error } = await context.supabase.storage.from("resumes").download(data.path);
    if (error || !file) throw new Error(error?.message ?? "File not found in storage");
    const text = await extractDocumentText(await file.arrayBuffer(), data.path);
    return { text };
  });

/** Parse a job description into structured requirements. */
export const parseJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobDescriptionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("./groq.server");
    const { supabase } = context;

    const { data: jd, error } = await supabase
      .from("job_descriptions")
      .select("id, raw_text")
      .eq("id", data.jobDescriptionId)
      .single();
    if (error || !jd) throw new Error("Job description not found");

    try {
      const parsed = await groqJson<ParsedJd>(
        `You are an expert technical recruiter. Extract structured requirements from a job description.
Reply with ONLY strict JSON of shape:
{"role_summary": string, "required_skills": string[], "preferred_skills": string[], "min_experience_years": number|null, "education_requirement": string|null}
Skills must be short canonical names (e.g. "React", "PostgreSQL", "Team leadership"). Max 20 required, 15 preferred.`,
        jd.raw_text,
      );

      await supabase
        .from("job_descriptions")
        .update({
          role_summary: parsed.role_summary ?? null,
          required_skills: asArray(parsed.required_skills),
          preferred_skills: asArray(parsed.preferred_skills),
          min_experience_years:
            typeof parsed.min_experience_years === "number" ? parsed.min_experience_years : null,
          education_requirement: parsed.education_requirement ?? null,
          parse_status: "parsed",
        })
        .eq("id", jd.id);

      return { ok: true as const };
    } catch (e) {
      console.error("[parse-jd] failed", e);
      await supabase
        .from("job_descriptions")
        .update({ parse_status: "failed" })
        .eq("id", jd.id);
      throw new Error("Could not parse this job description. Try re-parsing.");
    }
  });

async function recomputeRanks(
  supabase: { from: (t: string) => any },
  jobDescriptionId: string,
) {
  const { data: rows } = await supabase
    .from("match_results")
    .select("id, overall_score")
    .eq("job_description_id", jobDescriptionId)
    .order("overall_score", { ascending: false });

  if (!rows) return;
  await Promise.all(
    (rows as Array<{ id: string }>).map((row, i) =>
      supabase.from("match_results").update({ rank: i + 1 }).eq("id", row.id),
    ),
  );
}

/**
 * Full pipeline for one candidate: text extraction -> resume parsing ->
 * dual-score matching (deterministic keyword + LLM semantic) -> ranking.
 */
export const analyzeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ candidateId: z.string().uuid(), reparse: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const {
      groqJson,
      extractDocumentText,
      keywordScore,
      normalizeScore,
      KEYWORD_WEIGHT,
      SEMANTIC_WEIGHT,
    } = await import("./groq.server");

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", data.candidateId)
      .single();
    if (error || !candidate) throw new Error("Candidate not found");

    const { data: jd } = await supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", candidate.job_description_id)
      .single();
    if (!jd) throw new Error("Job description not found");

    await supabase
      .from("candidates")
      .update({ status: "processing", error_message: null })
      .eq("id", candidate.id);

    try {
      // 1. Raw text
      let rawText = candidate.raw_text ?? "";
      if (!rawText || data.reparse) {
        const { data: file, error: dlError } = await supabase.storage
          .from("resumes")
          .download(candidate.file_path);
        if (dlError || !file) throw new Error(dlError?.message ?? "Resume file missing");
        rawText = await extractDocumentText(
          await file.arrayBuffer(),
          candidate.file_name ?? candidate.file_path,
        );
      }
      if (!rawText || rawText.length < 40) {
        throw new Error("No readable text found in this file");
      }

      // 2. Structured resume
      const parsed = await groqJson<ParsedResume>(
        `You parse resumes into structured data. Reply with ONLY strict JSON:
{"full_name": string|null, "email": string|null, "phone": string|null, "skills": string[], "education": [{"degree": string, "institution": string, "year": string}], "experience": [{"role": string, "company": string, "duration": string, "description": string}], "total_experience_years": number|null}
Infer total_experience_years from the work history when not stated. Never invent facts.`,
        rawText,
      );

      // 3a. Deterministic keyword score
      const required = (jd.required_skills ?? []) as string[];
      const kw = keywordScore(required, asArray(parsed.skills), rawText);

      // 3b. LLM semantic score
      const semantic = await groqJson<SemanticResult>(
        `You are an impartial hiring analyst scoring a candidate against a job. Consider synonyms and equivalent experience ("React" ~ "React.js", "led a team" ~ "leadership").
Reply with ONLY strict JSON:
{"matched_skills": string[], "missing_skills": string[], "semantic_score": number (0-100), "rationale": string (2-3 sentences), "strength": string (one sentence), "concern": string (one sentence)}
Judge on evidence in the resume only. Never mention age, gender, nationality, or other protected attributes.`,
        JSON.stringify({
          job: {
            title: jd.title,
            summary: jd.role_summary,
            required_skills: jd.required_skills,
            preferred_skills: jd.preferred_skills,
            min_experience_years: jd.min_experience_years,
            education_requirement: jd.education_requirement,
          },
          candidate: parsed,
        }),
      );

      const semanticScore = normalizeScore(semantic.semantic_score);
      const overall = Math.round(KEYWORD_WEIGHT * kw.score + SEMANTIC_WEIGHT * semanticScore);

      await supabase
        .from("candidates")
        .update({
          full_name: parsed.full_name ?? candidate.file_name ?? "Unknown candidate",
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          raw_text: rawText,
          parsed_skills: asArray(parsed.skills),
          parsed_education: (parsed.education ?? []) as never,
          parsed_experience: (parsed.experience ?? []) as never,
          total_experience_years:
            typeof parsed.total_experience_years === "number" ? parsed.total_experience_years : null,
          status: "analyzed",
          error_message: null,
        })
        .eq("id", candidate.id);

      await supabase.from("match_results").upsert(
        {
          candidate_id: candidate.id,
          job_description_id: jd.id,
          overall_score: overall,
          keyword_score: kw.score,
          semantic_score: semanticScore,
          matched_skills: asArray(semantic.matched_skills).length
            ? asArray(semantic.matched_skills)
            : kw.matched,
          missing_skills: asArray(semantic.missing_skills).length
            ? asArray(semantic.missing_skills)
            : kw.missing,
          ai_summary: semantic.rationale ?? null,
          strengths: semantic.strength ?? null,
          concerns: semantic.concern ?? null,
        },
        { onConflict: "candidate_id" },
      );

      await recomputeRanks(supabase as never, jd.id);

      return { ok: true as const, overall_score: overall };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Analysis failed";
      console.error("[analyze-match] failed", message);
      await supabase
        .from("candidates")
        .update({ status: "failed", error_message: `${message} — needs manual review` })
        .eq("id", candidate.id);
      throw new Error(message);
    }
  });
