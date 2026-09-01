import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { extractStorageText, parseJobDescription } from "@/lib/screening.functions";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  head: () => ({
    meta: [
      { title: "New job description — SkillMatch AI" },
      { name: "description", content: "Paste or upload a job description and let AI extract the hiring rubric." },
      { property: "og:title", content: "New job description — SkillMatch AI" },
      { property: "og:description", content: "Paste or upload a job description and let AI extract the hiring rubric." },
    ],
  }),
  component: NewJobPage,
});

function NewJobPage() {
  const router = useRouter();
  const extractText = useServerFn(extractStorageText);
  const parseJd = useServerFn(parseJobDescription);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the role a title");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      let text = rawText.trim();
      if (!text && file) {
        const path = `${userId}/jd/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("resumes").upload(path, file);
        if (upErr) throw upErr;
        const res = await extractText({ data: { path } });
        text = res.text;
      }
      if (!text) throw new Error("Paste the JD text or upload a file");

      const { data: jd, error } = await supabase
        .from("job_descriptions")
        .insert({
          user_id: userId,
          title: title.trim(),
          company: company.trim() || null,
          raw_text: text,
        })
        .select("id")
        .single();
      if (error || !jd) throw error ?? new Error("Could not save the job description");

      toast.success("Job description saved — extracting requirements…");
      try {
        await parseJd({ data: { jobDescriptionId: jd.id } });
        toast.success("Requirements extracted");
      } catch {
        toast.error("AI extraction failed — you can re-parse from the JD page");
      }
      router.navigate({ to: "/jobs/$jobId", params: { jobId: jd.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="New job description"
        description="Paste the JD or upload a PDF/DOCX. AI extracts required skills, experience level and education."
      />

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-3xl space-y-6 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Role title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Frontend Engineer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
        </div>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="mt-4">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={14}
              placeholder="Paste the full job description here…"
              className="leading-relaxed"
            />
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:bg-accent/40">
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "Choose a PDF or DOCX job description"}
              </span>
              <span className="text-xs text-muted-foreground">Max 5MB</span>
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 5 * 1024 * 1024) {
                    toast.error("That file is larger than 5MB");
                    return;
                  }
                  setFile(f);
                }}
              />
            </label>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.navigate({ to: "/jobs" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save & extract requirements
          </Button>
        </div>
      </motion.form>
    </AppShell>
  );
}
