"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, Toggle, btnClass, tdClass, thClass } from "../ui";
import { Choice } from "../pickers";
import { nairaInput, useRun } from "../lib";

// Rooms & rates (docs/06): the room types table. Prices saved here reach the
// booking engine at once and the website within seconds.

export function RoomTypesView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const types = useQuery(api.admin.rooms.listTypes, {});
  const setPublished = useMutation(api.admin.rooms.setPublished);
  const reorder = useMutation(api.admin.rooms.reorder);
  const { run, pending } = useRun();
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<Id<"roomTypes"> | null>(null);

  const moveTo = (from: number, to: number) => {
    if (!types || to < 0 || to >= types.length || from === to) return;
    const ids = types.map((t) => t.id);
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    void run(() => reorder({ ids }), "Order saved. The website shows rooms in this order.");
  };

  return (
    <>
      <PageHeader
        title="Rooms & rates"
        subtitle="Prices you save here show on the website straight away."
        actions={
          <>
            <Link href="/admin/rooms/units" className={btnClass("default")}>
              Room units
            </Link>
            <Btn variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon aria-hidden /> Add room type
            </Btn>
          </>
        }
      />
      <Pane>
        <Panel title="Room types" aside={<span className="text-sm text-muted">Nightly rate in ₦ · weekend = Friday and Saturday nights</span>}>
          {types === undefined ? (
            <Loading />
          ) : types.length === 0 ? (
            <Empty>No room types yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>
                      <span className="sr-only">Order</span>
                    </th>
                    <th className={thClass}>Room</th>
                    <th className={thClass}>Units</th>
                    <th className={`${thClass} text-right`}>Weekday</th>
                    <th className={`${thClass} text-right`}>Weekend</th>
                    <th className={thClass}>Photos</th>
                    <th className={thClass}>On site</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t, i) => (
                    <tr
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = types.findIndex((x) => x.id === dragId);
                        setDragId(null);
                        moveTo(from, i);
                      }}
                      className="border-b border-[#EEF0F0] last:border-0 hover:bg-[#F7F8F7]"
                    >
                      <td className={`${tdClass} w-24 whitespace-nowrap`}>
                        <Btn variant="ghost" className="min-h-9 px-2" aria-label={`Move ${t.name} up`} disabled={i === 0 || pending} onClick={() => moveTo(i, i - 1)}>
                          <ArrowUpIcon aria-hidden />
                        </Btn>
                        <Btn variant="ghost" className="min-h-9 px-2" aria-label={`Move ${t.name} down`} disabled={i === types.length - 1 || pending} onClick={() => moveTo(i, i + 1)}>
                          <ArrowDownIcon aria-hidden />
                        </Btn>
                      </td>
                      <td className={tdClass}>
                        <Link href={`/admin/rooms/${t.id}`} className="font-semibold text-ink">
                          {t.name}
                        </Link>
                        <span className="block text-xs text-muted">/rooms/{t.slug}</span>
                      </td>
                      <td className={tdClass}>
                        {t.unitsActive}
                        {t.unitsTotal !== t.unitsActive ? <span className="text-muted"> of {t.unitsTotal}</span> : null}
                      </td>
                      <td className={`${tdClass} text-right`}>{t.baseRate ? nairaInput(t.baseRate) : <span className="text-bad">Not set</span>}</td>
                      <td className={`${tdClass} text-right`}>{nairaInput(t.weekendRate ?? t.baseRate) || "–"}</td>
                      <td className={tdClass}>
                        {t.photos}
                        {t.photosMissingAlt ? <Pill tone="bad" className="ml-2">{t.photosMissingAlt} need description</Pill> : null}
                      </td>
                      <td className={tdClass}>
                        <Toggle
                          checked={t.published}
                          label={`${t.name} shown on website`}
                          disabled={pending}
                          onChange={(on) => run(() => setPublished({ id: t.id, published: on }), on ? `${t.name} is live on the website` : `${t.name} is hidden from the website`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Pane>
      <AddTypeDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

function AddTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useMutation(api.admin.rooms.createType);
  const router = useRouter();
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"room" | "suite">("room");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = await run(() => create({ name, category }), `${name} added as a hidden draft`);
    if (id) router.push(`/admin/rooms/${id}`);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a room type</DialogTitle>
          <DialogDescription>It stays hidden from the website until it has rates, descriptions and photos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Garden Room" />}</FormField>
          <FormField label="Category">
            {(p) => (
              <Choice
                {...p}
                value={category}
                onChange={(v) => setCategory(v as "room" | "suite")}
                options={[
                  { value: "room", label: "Room" },
                  { value: "suite", label: "Suite" },
                ]}
              />
            )}
          </FormField>
          <DialogFooter className="flex-row justify-end gap-2">
            <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={pending || !name.trim()}>
              Add and edit
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
