import type { Tables } from "@/integrations/supabase/types";

export type ExperienceItem = {
  role?: string;
  company?: string;
  duration?: string;
  description?: string;
};

export type EducationItem = { degree?: string; institution?: string; year?: string };

export type CandidateRow = Omit<Tables<"candidates">, "parsed_experience" | "parsed_education"> & {
  parsed_experience: ExperienceItem[] | null;
  parsed_education: EducationItem[] | null;
  match: Tables<"match_results"> | null;
};
