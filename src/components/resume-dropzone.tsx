import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, FileUp, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCandidate } from "@/lib/screening.functions";
import { cn } from "@/lib/utils";

type Item = { name: string; progress: number; state: "uploading" | "analyzing" | "done" | "error" };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 20;

function validate(file: File) {
  const ok = /\.(pdf|docx)$/i.test(file.name);
  if (!ok) return "Only PDF and DOCX files are supported";
  if (file.size > MAX_BYTES) return "File is larger than 5MB";
  return null;
}

export function ResumeDropzone({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const analyze = useServerFn(analyzeCandidate);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const update = (name: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, ...patch } : i)));

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const files = Array.from(fileList).slice(0, MAX_FILES);
      if (fileList.length > MAX_FILES) toast.error(`Only the first ${MAX_FILES} files were taken`);

      const valid: File[] = [];
      for (const f of files) {
        const err = validate(f);
        if (err) toast.error(`${f.name}: ${err}`);
        else valid.push(f);
      }
      if (!valid.length) return;

      setItems(valid.map((f) => ({ name: f.name, progress: 10, state: "uploading" as const })));

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Session expired — sign in again");
        return;
      }

      for (const file of valid) {
        try {
          const path = `${userId}/${jobId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("resumes").upload(path, file);
          if (upErr) throw upErr;
          update(file.name, { progress: 55, state: "analyzing" });

          const { data: candidate, error } = await supabase
            .from("candidates")
            .insert({
              user_id: userId,
              job_description_id: jobId,
              file_path: path,
              file_name: file.name,
              full_name: file.name.replace(/\.(pdf|docx)$/i, ""),
            })
            .select("id")
            .single();
          if (error || !candidate) throw error ?? new Error("Could not save candidate");

          onDone();
          await analyze({ data: { candidateId: candidate.id } });
          update(file.name, { progress: 100, state: "done" });
          onDone();
        } catch (err) {
          update(file.name, { progress: 100, state: "error" });
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "analysis failed"}`);
          onDone();
        }
      }

      toast.success("Screening complete");
      setTimeout(() => setItems([]), 2500);
    },
    [analyze, jobId, onDone],
  );

  return (
    <div className="space-y-3">
      <motion.div
        animate={
          dragging
            ? { scale: 1.02, borderColor: "var(--color-primary)" }
            : { scale: 1, borderColor: "var(--color-border)" }
        }
        transition={{ duration: 0.15 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          dragging ? "bg-accent/60" : "bg-muted/30 hover:bg-accent/30",
        )}
      >
        <FileUp className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Drop resumes here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF or DOCX · max 5MB each · up to 20 files at once
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </motion.div>

      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.name}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="truncate">{item.name}</span>
              <span className="ml-auto shrink-0">
                {item.state === "done" ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="text-[color:var(--color-success)]"
                  >
                    <Check className="size-4" />
                  </motion.span>
                ) : item.state === "error" ? (
                  <X className="size-4 text-destructive" />
                ) : (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "5%" }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
