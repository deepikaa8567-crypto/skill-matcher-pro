import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo@skillmatch.app";
export const DEMO_PASSWORD = "demo12345";

/**
 * Ensures a ready-to-use demo account exists (confirmed email) and that it has
 * sample data to look at. Safe to call repeatedly.
 */
export const ensureDemoAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Find or create the demo auth user.
  let demoUserId: string | undefined;

  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  demoUserId = list?.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)?.id;

  if (!demoUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { demo: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create demo account");
    demoUserId = data.user.id;
  } else {
    // Keep the password in sync in case it was changed.
    await supabaseAdmin.auth.admin.updateUserById(demoUserId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
  }

  // 2. Seed the demo workspace by cloning existing sample data once.
  const { count } = await supabaseAdmin
    .from("job_descriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", demoUserId);

  if (!count) {
    const { data: sourceJobs } = await supabaseAdmin
      .from("job_descriptions")
      .select("*")
      .neq("user_id", demoUserId)
      .order("created_at", { ascending: true })
      .limit(5);

    for (const job of sourceJobs ?? []) {
      const { id: sourceJobId, user_id: _u, ...jobFields } = job;
      const { data: newJob } = await supabaseAdmin
        .from("job_descriptions")
        .insert({ ...jobFields, user_id: demoUserId })
        .select("id")
        .single();
      if (!newJob) continue;

      const { data: sourceCandidates } = await supabaseAdmin
        .from("candidates")
        .select("*")
        .eq("job_description_id", sourceJobId);

      for (const candidate of sourceCandidates ?? []) {
        const { id: sourceCandidateId, user_id: _cu, ...candidateFields } = candidate;
        const { data: newCandidate } = await supabaseAdmin
          .from("candidates")
          .insert({
            ...candidateFields,
            user_id: demoUserId,
            job_description_id: newJob.id,
          })
          .select("id")
          .single();
        if (!newCandidate) continue;

        const { data: sourceMatch } = await supabaseAdmin
          .from("match_results")
          .select("*")
          .eq("candidate_id", sourceCandidateId)
          .maybeSingle();

        if (sourceMatch) {
          const { id: _mid, ...matchFields } = sourceMatch;
          await supabaseAdmin.from("match_results").insert({
            ...matchFields,
            candidate_id: newCandidate.id,
            job_description_id: newJob.id,
          });
        }
      }
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
