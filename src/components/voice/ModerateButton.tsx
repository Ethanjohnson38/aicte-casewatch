"use client";

import { useState } from "react";
import { moderatePost } from "@/app/actions/voice";

// Staff moderation control. Requires a reason before hiding/restoring a post.
export default function ModerateButton({ postId, hidden }: { postId: string; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const verb = hidden ? "Restore" : "Hide";

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-ink-muted hover:text-accent"
      >
        {verb}
      </button>
    );

  return (
    <form action={moderatePost} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="action" value={hidden ? "restore" : "hide"} />
      <input
        name="reason"
        required
        placeholder="Reason (required)"
        aria-label="Moderation reason"
        className="h-7 w-40 rounded-xs border border-line-strong bg-surface px-2 text-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
      <button type="submit" className="text-xs font-medium text-accent hover:underline">
        {verb}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-subtle hover:text-ink">
        Cancel
      </button>
    </form>
  );
}
