"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, tdClass, thClass } from "../ui";
import { Choice } from "../pickers";
import { errorField, errorText, formatDay, formatStamp, useRun } from "../lib";

// Staff (docs/06, admin only): invite, change role, deactivate.

export function StaffView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

type Person = NonNullable<ReturnType<typeof useQuery<typeof api.admin.staff.list>>>["staff"][number];

function Inner() {
  const data = useQuery(api.admin.staff.list, {});
  const setRole = useMutation(api.admin.staff.setRole);
  const setActive = useMutation(api.admin.staff.setActive);
  const resend = useMutation(api.admin.staff.resendInvite);
  const revoke = useMutation(api.admin.staff.revokeInvite);
  const { run, pending } = useRun();
  const [inviting, setInviting] = useState(false);
  const [deactivating, setDeactivating] = useState<Person | null>(null);

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Admins manage rooms, prices, website content and staff. Front-desk staff handle bookings and messages."
        actions={
          <Btn variant="primary" onClick={() => setInviting(true)}>
            <PlusIcon aria-hidden /> Invite someone
          </Btn>
        }
      />
      <Pane>
        <Panel title="Accounts">
          {data === undefined ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Role</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Last sign-in</th>
                    <th className={thClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((s) => (
                    <tr key={s.id} className="border-b border-[#EEF0F0] last:border-0">
                      <td className={tdClass}>
                        <strong>{s.name}</strong>
                        {s.id === data.meId ? <span className="text-muted"> (you)</span> : null}
                        <span className="block text-xs text-muted">{s.email}</span>
                      </td>
                      <td className={tdClass}>
                        <Choice
                          aria-label={`Role for ${s.name}`}
                          className="w-40"
                          value={s.role}
                          disabled={pending || !s.active}
                          onChange={(v) => run(() => setRole({ id: s.id, role: v as "admin" | "staff" }), `${s.name} is now ${v === "admin" ? "an admin" : "front-desk staff"}`)}
                          options={[
                            { value: "staff", label: "Front desk" },
                            { value: "admin", label: "Admin" },
                          ]}
                        />
                      </td>
                      <td className={tdClass}>{s.active ? <Pill tone="ok">Active</Pill> : <Pill tone="mute">Deactivated</Pill>}</td>
                      <td className={`${tdClass} text-muted`}>{s.lastSignInAt ? formatStamp(s.lastSignInAt) : "Never"}</td>
                      <td className={`${tdClass} text-right`}>
                        {s.id === data.meId ? null : s.active ? (
                          <Btn variant="danger" onClick={() => setDeactivating(s)}>
                            Deactivate
                          </Btn>
                        ) : (
                          <Btn disabled={pending} onClick={() => run(() => setActive({ id: s.id, active: true }), `${s.name} can sign in again`)}>
                            Reactivate
                          </Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Open invitations">
          {data === undefined ? null : data.invites.length === 0 ? (
            <Empty>No open invitations.</Empty>
          ) : (
            <ul className="m-0 list-none p-0">
              {data.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0F0] px-5 py-3 text-sm last:border-0">
                  <span className="min-w-0 flex-1">
                    <strong>{i.name ?? i.email}</strong> <span className="text-muted">{i.email}</span>
                    <span className="block text-xs text-muted">
                      {i.role === "admin" ? "Admin" : "Front desk"} · {i.expired ? <span className="text-bad">expired</span> : `expires ${formatDay(i.expiresAt)}`}
                    </span>
                  </span>
                  <Btn disabled={pending} onClick={() => run(() => resend({ id: i.id }), `Invitation re-sent to ${i.email}`)}>
                    Resend
                  </Btn>
                  <Btn variant="ghost" className="text-bad" disabled={pending} onClick={() => run(() => revoke({ id: i.id }), "Invitation withdrawn")}>
                    Withdraw
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Pane>
      <InviteDialog open={inviting} onOpenChange={setInviting} />
      <AlertDialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&rsquo;re signed out everywhere straight away and can&rsquo;t sign in again until an admin reactivates them. Their bookings and history stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivating && run(() => setActive({ id: deactivating.id as Id<"staffProfiles">, active: false }), `${deactivating.name} deactivated`)}
              className="bg-bad text-white hover:bg-bad/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useMutation(api.admin.staff.invite);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await invite({ name, email, role });
      toast.success(`Invitation sent to ${email}`);
      setName("");
      setEmail("");
      setErr(null);
      onOpenChange(false);
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email with a link to create their account. It works for 7 days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField label="Name" error={err?.field === "name" ? err.message : null}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />}</FormField>
          <FormField label="Work email" error={err?.field === "email" ? err.message : null}>{(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</FormField>
          <FormField label="Role">
            {(p) => (
              <Choice
                {...p}
                value={role}
                onChange={(v) => setRole(v as "admin" | "staff")}
                options={[
                  { value: "staff", label: "Front desk: bookings, availability, messages" },
                  { value: "admin", label: "Admin: everything, including prices and staff" },
                ]}
              />
            )}
          </FormField>
          {err && !err.field ? <p className="m-0 text-sm text-bad">{err.message}</p> : null}
          <DialogFooter className="flex-row justify-end gap-2">
            <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              Send invitation
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
