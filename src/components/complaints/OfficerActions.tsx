"use client";

import { useActionState } from "react";
import type { ComplaintStatus, Priority } from "@prisma/client";
import {
  assignComplaint,
  updateStatus,
  updatePriority,
  addInternalNote,
} from "@/app/actions/complaints";
import { Button } from "@/components/ui/button";
import { Select, TextArea, TextInput } from "@/components/ui/field";
import { PRIORITY_META, PRIORITY_VALUES, STATUS_META, STATUS_VALUES } from "@/lib/format";

type ActionState = { ok?: boolean; error?: string; message?: string };
type Officer = { id: string; pseudonym: string };

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p className="text-xs text-accent" role="alert">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p className="text-xs text-green-700" role="status">
        {state.message}
      </p>
    );
  return null;
}

export default function OfficerActions({
  complaintId,
  status,
  priority,
  assignedOfficerId,
  currentUserId,
  officers,
}: {
  complaintId: string;
  status: ComplaintStatus;
  priority: Priority;
  assignedOfficerId: string | null;
  currentUserId: string;
  officers: Officer[];
}) {
  const [assignState, assignAction, assigning] = useActionState(assignComplaint, {});
  const [statusState, statusAction, statusPending] = useActionState(updateStatus, {});
  const [prioState, prioAction, prioPending] = useActionState(updatePriority, {});
  const [noteState, noteAction, notePending] = useActionState(addInternalNote, {});

  const isAssignedToMe = assignedOfficerId === currentUserId;

  return (
    <div className="rounded-md border border-line bg-surface shadow-card">
      <p className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
        Officer actions
      </p>
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {/* Assignment */}
        <form key={`a-${assignedOfficerId}`} action={assignAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">Assignment</label>
          <Select name="assigneeId" defaultValue={assignedOfficerId ?? ""}>
            <option value="">Unassigned</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.pseudonym}
                {o.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={assigning}>
              Save assignment
            </Button>
            {!isAssignedToMe && (
              <button
                type="submit"
                name="quickAssign"
                value="me"
                disabled={assigning}
                className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
              >
                Assign to me
              </button>
            )}
          </div>
          <Feedback state={assignState} />
        </form>

        {/* Priority */}
        <form key={`p-${priority}`} action={prioAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">Priority</label>
          <Select name="priority" defaultValue={priority}>
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" size="sm" disabled={prioPending}>
            Update priority
          </Button>
          <Feedback state={prioState} />
        </form>

        {/* Status (with reason — covers resolve/reopen) */}
        <form key={`s-${status}`} action={statusAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">Status</label>
          <Select name="status" defaultValue={status}>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
          <TextInput name="reason" placeholder="Reason (required for resolve/reopen)" />
          <Button type="submit" variant="secondary" size="sm" disabled={statusPending}>
            Update status
          </Button>
          <Feedback state={statusState} />
        </form>

        {/* Internal note */}
        <form action={noteAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">
            Internal note <span className="font-normal text-ink-subtle">(staff only)</span>
          </label>
          <TextArea name="note" rows={3} placeholder="Visible to officers and admins only." />
          <Button type="submit" variant="secondary" size="sm" disabled={notePending}>
            Add note
          </Button>
          <Feedback state={noteState} />
        </form>
      </div>
    </div>
  );
}
