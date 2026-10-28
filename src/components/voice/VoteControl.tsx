"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vote } from "@/app/actions/voice";

export default function VoteControl({
  postId,
  initialScore,
  initialVote,
  canVote,
}: {
  postId: string;
  initialScore: number;
  initialVote: 1 | -1 | 0;
  canVote: boolean;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState<1 | -1 | 0>(initialVote);
  const [pending, start] = useTransition();

  function cast(value: 1 | -1) {
    if (!canVote) {
      router.push("/login");
      return;
    }
    const next: 1 | -1 | 0 = myVote === value ? 0 : value;
    setScore((s) => s - myVote + next); // mirror server toggle math
    setMyVote(next);
    start(() => vote(postId, value));
  }

  const arrow = (dir: 1 | -1) => {
    const active = myVote === dir;
    const activeColor = dir === 1 ? "text-ember" : "text-ocean";
    return (
      <button
        onClick={() => cast(dir)}
        disabled={pending}
        aria-label={dir === 1 ? "Upvote" : "Downvote"}
        aria-pressed={active}
        className={`grid h-7 w-7 place-items-center rounded-sm transition-colors hover:bg-sunken ${
          active ? activeColor : "text-ink-subtle"
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
          {dir === 1 ? (
            <path d="M10 4l6 8H4l6-8z" />
          ) : (
            <path d="M10 16l-6-8h12l-6 8z" />
          )}
        </svg>
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {arrow(1)}
      <span className="font-mono text-sm font-semibold tabular-nums text-ink">{score}</span>
      {arrow(-1)}
    </div>
  );
}
