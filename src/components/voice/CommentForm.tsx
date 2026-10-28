"use client";

import { useActionState, useRef, useEffect } from "react";
import { addComment } from "@/app/actions/voice";
import { Button } from "@/components/ui/button";

export default function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(addComment, {});
  const ref = useRef<HTMLFormElement>(null);

  // Clear the box after a successful submit (no error returned).
  useEffect(() => {
    if (!pending && !state.error) ref.current?.reset();
  }, [pending, state]);

  return (
    <form ref={ref} action={action} className="mt-3 flex items-start gap-2">
      <input type="hidden" name="postId" value={postId} />
      <div className="flex-1">
        <input
          name="body"
          required
          minLength={2}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="w-full rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-sm placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {state.error && (
          <p className="mt-1 text-xs text-accent" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "…" : "Reply"}
      </Button>
    </form>
  );
}
