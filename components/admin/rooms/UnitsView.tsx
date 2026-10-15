"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, Textarea, tdClass, thClass } from "../ui";
import { Choice } from "../pickers";
import { useRun } from "../lib";

// Room units (docs/06): the physical rooms behind each room type.

type Unit = NonNullable<ReturnType<typeof useQuery<typeof api.admin.rooms.listUnits>>>[number];

export function UnitsView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const units = useQuery(api.admin.rooms.listUnits, {});
  const types = useQuery(api.admin.rooms.listTypes, {});
  const [edit, setEdit] = useState<Unit | "new" | null>(null);
  const [service, setService] = useState<Unit | null>(null);
  return (
    <>
      <PageHeader
        title="Room units"
        subtitle={<Link href="/admin/rooms">Rooms &amp; rates</Link>}
        actions={
          <Btn variant="primary" onClick={() => setEdit("new")}>
            <PlusIcon aria-hidden /> Add room
          </Btn>
        }
      />
      <Pane>
        <Panel>
          {units === undefined ? (
            <Loading />
          ) : units.length === 0 ? (
            <Empty>No rooms yet. Add the hotel&rsquo;s room numbers so bookings can be assigned.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>Room</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Floor</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Notes</th>
                    <th className={thClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} className="border-b border-[#EEF0F0] last:border-0">
                      <td className={`${tdClass} font-semibold`}>{u.number}</td>
                      <td className={tdClass}>{u.typeName}</td>
                      <td className={tdClass}>{u.floor ?? "–"}</td>
                      <td className={tdClass}>{u.status === "active" ? <Pill tone="ok">In service</Pill> : <Pill tone="bad">Out of service</Pill>}</td>
                      <td className={`${tdClass} text-muted`}>{u.notes}</td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        <Btn variant="ghost" onClick={() => setEdit(u)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" onClick={() => setService(u)}>
                          {u.status === "active" ? "Take out of service" : "Back in service"}
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Pane>
      {edit ? <UnitDialog unit={edit === "new" ? null : edit} types={types ?? []} onClose={() => setEdit(null)} /> : null}
      {service ? <ServiceDialog unit={service} onClose={() => setService(null)} /> : null}
    </>
  );
}

function UnitDialog({ unit, types, onClose }: { unit: Unit | null; types: { id: Id<"roomTypes">; name: string }[]; onClose: () => void }) {
  const create = useMutation(api.admin.rooms.createUnit);
  const update = useMutation(api.admin.rooms.updateUnit);
  const { run, pending } = useRun();
  const [number, setNumber] = useState(unit?.number ?? "");
  const [typeId, setTypeId] = useState<string>(unit?.roomTypeId ?? types[0]?.id ?? "");
  const [floor, setFloor] = useState(unit?.floor ?? "");
  const [notes, setNotes] = useState(unit?.notes ?? "");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const roomTypeId = typeId as Id<"roomTypes">;
    const ok = await run(
      () => (unit ? update({ id: unit.id, number, roomTypeId, floor: floor || undefined, notes: notes || undefined }) : create({ number, roomTypeId, floor: floor || undefined })),
      unit ? `Room ${number} saved` : `Room ${number} added`,
    );
    if (ok !== undefined) onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unit ? `Room ${unit.number}` : "Add a room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <FormField label="Room number">{(p) => <Input {...p} value={number} onChange={(e) => setNumber(e.target.value)} required maxLength={10} />}</FormField>
          <FormField label="Floor (optional)">{(p) => <Input {...p} value={floor} onChange={(e) => setFloor(e.target.value)} maxLength={20} />}</FormField>
          <FormField label="Room type" className="col-span-2" hint={unit ? "A room with upcoming bookings can't change type." : undefined}>
            {(p) => (
              <Choice {...p} value={typeId} onChange={setTypeId} options={types.map((t) => ({ value: t.id, label: t.name }))} />
            )}
          </FormField>
          {unit ? <FormField label="Notes" className="col-span-2">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</FormField> : null}
          <DialogFooter className="col-span-2 flex-row justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={pending || !number.trim() || !typeId}>
              Save
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const setStatus = useMutation(api.admin.rooms.setUnitStatus);
  const bookings = useQuery(api.admin.rooms.unitBookings, unit.status === "active" ? { id: unit.id } : "skip");
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  const goingOut = unit.status === "active";
  const blocked = goingOut && (bookings?.length ?? 0) > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goingOut ? `Take room ${unit.number} out of service?` : `Put room ${unit.number} back in service?`}</DialogTitle>
          <DialogDescription>
            {goingOut ? "It won't be offered to guests or staff until it's back in service." : "Guests can book it again straight away."}
          </DialogDescription>
        </DialogHeader>
        {blocked ? (
          <div className="rounded-md bg-warn-bg p-3 text-sm text-warn">
            <strong>Move these bookings to another room first:</strong>
            <ul className="m-0 mt-1 pl-5">
              {bookings!.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/reservations/${b.id}`}>{b.ref}</Link>, {b.guest}, {b.checkIn} – {b.checkOut}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {goingOut && !blocked ? <FormField label="Reason">{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. AC repair" maxLength={200} />}</FormField> : null}
        <DialogFooter className="flex-row justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant={goingOut ? "danger" : "primary"}
            disabled={pending || blocked || (goingOut && bookings === undefined)}
            onClick={async () => {
              const ok = await run(() => setStatus({ id: unit.id, status: goingOut ? "out_of_service" : "active", notes: note || undefined }), goingOut ? `Room ${unit.number} is out of service` : `Room ${unit.number} is back in service`);
              if (ok !== undefined) onClose();
            }}
          >
            {goingOut ? "Take out of service" : "Back in service"}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
