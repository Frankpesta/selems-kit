"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { AnimatePresence, m } from "framer-motion";
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleAlertIcon,
  LoaderIcon,
  MapPinIcon,
  MessageCircleIcon,
  SquarePenIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { StayPicker } from "@/components/site/StayPicker";
import type { Stay } from "@/components/site/stay-shared";
import { EASE_OUT } from "@/components/motion/tokens";
import { isDateString, nightsBetween } from "@/lib/dates";
import { formatDate, formatDateShort, formatParty, plural } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { toAppError } from "@/lib/errors";
import { downloadIcs, stayIcs } from "@/lib/ics";
import { cn } from "@/lib/utils";
import { BookingSummary, type SummaryRoom } from "./BookingSummary";
import { DetailsForm, validateDetails, type DetailErrors } from "./DetailsForm";
import { EMPTY_DETAILS, type Confirmation, type GuestDetails, type HotelInfo } from "./types";

// The booking flow (docs/05): Dates → Room → Your details → Review & reserve →
// Confirmed. Steps and the stay live in the URL so refresh and Back work; guest
// details live in sessionStorage (cleared on success).

const STEPS = ["Dates", "Room", "Your details", "Review", "Confirmed"] as const;
const DETAILS_KEY = "selems:booking-details";
const CONFIRM_KEY = "selems:last-booking";

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export function BookingFlow({ hotel }: { hotel: HotelInfo }) {
  const router = useRouter();
  const params = useSearchParams();
  const top = useRef<HTMLDivElement>(null);

  // ── URL state ────────────────────────────────────────────────────────────
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const adults = Math.min(4, Math.max(1, Number(params.get("adults")) || 2));
  const children = Math.min(3, Math.max(0, Number(params.get("children")) || 0));
  const roomSlug = params.get("room") ?? "";
  const datesOk = isDateString(checkIn) && isDateString(checkOut) && checkOut > checkIn;
  const nights = datesOk ? nightsBetween(checkIn, checkOut) : 0;
  const requested = Number(params.get("step")) || 0;

  const search = useQuery(
    api.public.booking.search,
    datesOk ? { checkIn, checkOut, adults, children } : "skip",
  );
  const results = search?.ok ? search.results : [];
  const chosen = results.find((r) => r.slug === roomSlug && r.available > 0) ?? null;

  // Which step to show: the requested one, unless something it needs is missing.
  // A ?room= link (from a room page) skips step 2 when that room is available.
  // While availability is loading for a linked room, show a loading state
  // rather than guessing (avoids flashing the details form, then step 2).
  const step = useMemo(() => {
    if (requested === 5) return 5;
    if (!datesOk || requested === 1) return 1;
    if (!roomSlug || requested === 2) return 2;
    if (search === undefined) return 0; // loading
    if (!chosen) return 2; // sold out, too small or unknown room
    return requested === 4 ? 4 : 3;
  }, [requested, datesOk, roomSlug, search, chosen]);
  // A linked room that turned out to be unavailable: pin the guest on step 2
  // (in the URL) so a later change in availability doesn't move them around.
  const unavailableSlug = params.get("unavailable");
  const linkedName = search?.ok ? search.results.find((r) => r.slug === unavailableSlug)?.name : undefined;
  const inFlight = useRef(false); // our own booking may sell out the room we're reserving
  useEffect(() => {
    if (inFlight.current || requested === 5) return;
    if (roomSlug && search?.ok && !chosen && requested !== 2) {
      const q = new URLSearchParams(params.toString());
      q.set("step", "2");
      q.set("unavailable", roomSlug);
      q.delete("room");
      router.replace(`/book?${q}`, { scroll: false });
    }
  }, [roomSlug, search, chosen, requested, params, router]);

  const go = (next: Record<string, string | number | null>, opts: { replace?: boolean } = {}) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") q.delete(k);
      else q.set(k, String(v));
    }
    const url = `/book?${q.toString()}`;
    if (opts.replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Step 1 state: an unsaved stay until "Show available rooms" ────────────
  // Reset the draft whenever the stay in the URL changes (adjusting state during render).
  const urlStay = `${checkIn}|${checkOut}|${adults}|${children}`;
  const [draftFor, setDraftFor] = useState(urlStay);
  const [draft, setDraft] = useState<Stay>({ checkIn, checkOut, adults, children });
  if (draftFor !== urlStay) {
    setDraftFor(urlStay);
    setDraft({ checkIn, checkOut, adults, children });
  }

  // ── Guest details (sessionStorage) ───────────────────────────────────────
  // This component only renders in the browser (useSearchParams under Suspense
  // on a static page), so sessionStorage is safe to read for initial state.
  const [details, setDetails] = useState<GuestDetails>(() => ({ ...EMPTY_DETAILS, ...readJson<GuestDetails>(DETAILS_KEY) }));
  const [errors, setErrors] = useState<DetailErrors>({});
  useEffect(() => {
    try {
      sessionStorage.setItem(DETAILS_KEY, JSON.stringify(details));
    } catch {}
  }, [details]);

  // ── Reserve ──────────────────────────────────────────────────────────────
  const reserve = useAction(api.public.booking.reserve);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(() => readJson<Confirmation>(CONFIRM_KEY));

  async function submit() {
    if (!chosen || submitting) return;
    const errs = validateDetails(details);
    if (Object.keys(errs).length) {
      setErrors(errs);
      go({ step: 3 });
      return;
    }
    if (!agreed) {
      setNotice("Please tick the box to agree to the booking terms.");
      return;
    }
    setSubmitting(true);
    setNotice(null);
    inFlight.current = true;
    try {
      const { ref, token } = await reserve({
        roomTypeSlug: chosen.slug,
        checkIn,
        checkOut,
        adults,
        children,
        guest: { firstName: details.firstName, lastName: details.lastName, email: details.email, phone: details.phone },
        arrivalWindow: details.arrivalWindow || undefined,
        purpose: details.purpose || undefined,
        specialRequests: details.specialRequests.trim() || undefined,
        acceptedTerms: true,
      });
      const done: Confirmation = {
        ref,
        token,
        firstName: details.firstName.trim(),
        email: details.email.trim(),
        roomName: chosen.name,
        checkIn,
        checkOut,
        nights,
        adults,
        children,
        total: chosen.total,
      };
      setConfirmation(done);
      try {
        sessionStorage.setItem(CONFIRM_KEY, JSON.stringify(done));
        sessionStorage.removeItem(DETAILS_KEY);
      } catch {}
      // Analytics (no PII): fires only if GA4 has been loaded after consent.
      (window as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "booking_reserved", {
        value: chosen.total / 100,
        currency: "NGN",
        items: [{ item_id: chosen.slug, item_name: chosen.name, quantity: nights }],
      });
      go({ step: 5 }, { replace: true }); // Back won't resubmit
    } catch (e) {
      inFlight.current = false;
      const err = toAppError(e);
      if (err.code === "SOLD_OUT") {
        setNotice(`Someone just booked the last ${chosen.name} for these dates. Here's what's still available.`);
        go({ step: 2, room: null });
      } else if (err.code === "RATE_LIMITED") {
        setNotice(`${err.message} Call ${hotel.phone.display}.`);
      } else if (err.field && err.field in EMPTY_DETAILS) {
        setErrors({ [err.field]: err.message });
        go({ step: 3 });
      } else {
        setNotice(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const summaryRoom: SummaryRoom | null = chosen
    ? { name: chosen.name, cover: chosen.cover, groups: chosen.groups, total: chosen.total, offer: chosen.offer }
    : null;

  return (
    <div ref={top} className="container-site scroll-mt-4 flex flex-col gap-8 pt-8 pb-24 min-[760px]:pt-10">
      <StepIndicator step={Math.max(step, 1)} />

      <div className="grid grid-cols-1 items-start gap-8 min-[980px]:grid-cols-[minmax(0,1fr)_380px] min-[980px]:gap-12">
        {step < 5 ? (
          <div className="min-[980px]:order-2">
            <BookingSummary
              room={step >= 3 ? summaryRoom : null}
              checkIn={checkIn}
              checkOut={checkOut}
              nights={nights}
              adults={adults}
              childCount={children}
              hotel={hotel}
            />
          </div>
        ) : null}

        <div className={cn("flex min-w-0 flex-col gap-6", step === 5 && "min-[980px]:col-span-2")}>
          {unavailableSlug && step === 2 && !notice ? (
            <p role="status" className="m-0 flex items-start gap-3 border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
              <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              {linkedName
                ? `The ${linkedName} isn't available for these dates and guests. Here's what is.`
                : "That room isn't available for these dates. Here's what is."}
            </p>
          ) : null}
          {notice ? (
            <p role="alert" className="m-0 flex items-start gap-3 border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
              <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              {notice}
            </p>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            <m.section
              key={step}
              aria-labelledby="step-title"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="flex flex-col gap-6"
            >
              {step === 0 ? (
                <p className="m-0 flex min-h-[40vh] items-start gap-2 text-muted-foreground" aria-busy="true">
                  <LoaderIcon className="mt-1 size-4 animate-spin" aria-hidden="true" /> Checking availability…
                </p>
              ) : null}

              {step === 1 ? (
                <>
                  <h1 id="step-title" className="font-display m-0 text-[40px] min-[760px]:text-[48px]">
                    When are you staying?
                  </h1>
                  <div className="border border-line bg-paper p-6">
                    <StayPicker
                      value={draft}
                      onChange={setDraft}
                      idPrefix="bk"
                      maxNights={hotel.maxNights}
                      windowDays={hotel.windowDays}
                    />
                  </div>
                  <p className="m-0 text-muted-foreground" aria-live="polite">
                    {draft.checkIn && draft.checkOut
                      ? `${plural(nightsBetween(draft.checkIn, draft.checkOut), "night")} · ${formatDateShort(draft.checkIn)} to ${formatDateShort(draft.checkOut)} · ${formatParty(draft.adults, draft.children)}`
                      : "Choose your check-in and check-out dates."}
                  </p>
                  <p className="m-0 text-sm text-muted-foreground">
                    One room per online booking. For several rooms, weddings or events,{" "}
                    <Link href="/contact?subject=group">ask us for a group booking</Link>.
                  </p>
                  <div>
                    <button
                      type="button"
                      disabled={!(draft.checkIn && draft.checkOut)}
                      onClick={() => go({ ...draft, step: roomSlug ? 3 : 2, unavailable: null })}
                      className={buttonVariants({ variant: "amber", size: "cta" })}
                    >
                      Show available rooms
                    </button>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h1 id="step-title" className="font-display m-0 text-[40px] min-[760px]:text-[48px]">
                        Choose a room
                      </h1>
                      <p className="mt-2 mb-0 text-muted-foreground">
                        Prices for {plural(nights, "night")}, {formatDateShort(checkIn)} – {formatDateShort(checkOut)},{" "}
                        {formatParty(adults, children)}.
                      </p>
                    </div>
                    <button type="button" onClick={() => go({ step: 1 })} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber">
                      <SquarePenIcon className="size-4" aria-hidden="true" /> Change dates
                    </button>
                  </div>
                  {search === undefined ? (
                    <div className="flex flex-col gap-3" aria-busy="true">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-[124px] animate-pulse border border-line bg-mist/60" />
                      ))}
                    </div>
                  ) : !search.ok ? (
                    <p className="m-0 flex items-start gap-2 text-bad">
                      <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" /> {search.error.message}
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {search.results.map((r, i) => {
                        const disabled = r.available === 0;
                        const selected = r.slug === roomSlug && !disabled;
                        return (
                          <m.li
                            key={r.slug}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: EASE_OUT, delay: Math.min(i, 8) * 0.04 }}
                          >
                            <button
                              type="button"
                              disabled={disabled}
                              aria-pressed={selected}
                              onClick={() => go({ room: r.slug, step: 3, unavailable: null })}
                              className={cn(
                                "grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-4 border bg-paper p-3 text-left transition-[border-color,box-shadow] min-[560px]:grid-cols-[132px_minmax(0,1fr)_auto] min-[560px]:gap-5",
                                selected ? "border-amber shadow-[inset_0_0_0_1px_var(--color-amber)]" : "border-line hover:border-ink",
                                disabled && "cursor-not-allowed opacity-55 hover:border-line",
                              )}
                            >
                              {r.cover ? (
                                <Image
                                  src={r.cover.url}
                                  alt=""
                                  width={r.cover.width}
                                  height={r.cover.height}
                                  sizes="132px"
                                  className="aspect-[4/3] w-full object-cover"
                                />
                              ) : (
                                <span className="aspect-[4/3] bg-mist" />
                              )}
                              <span className="flex min-w-0 flex-col gap-1">
                                <span className="font-display text-[24px] leading-tight">{r.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {r.facts.filter((f) => f !== "Suite").slice(0, 3).join(" · ")}
                                </span>
                                <span className="flex flex-wrap gap-2 text-sm font-semibold">
                                  {r.offer ? <span className="bg-velvet px-2 py-0.5 text-xs text-white">{r.offer.title}</span> : null}
                                  {disabled ? (
                                    <span className="text-bad">{r.fitsParty ? "Sold out for these dates" : `Sleeps up to ${r.maxAdults} adults`}</span>
                                  ) : r.available <= 2 ? (
                                    <span className="text-warn">Only {r.available} left</span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="col-span-2 flex items-baseline justify-between gap-3 border-t border-line pt-3 tabular-nums min-[560px]:col-span-1 min-[560px]:flex-col min-[560px]:items-end min-[560px]:border-0 min-[560px]:pt-0">
                                <span className="text-lg font-semibold">{formatNaira(r.total)}</span>
                                <span className="text-sm text-muted-foreground">
                                  {formatNaira(Math.round(r.total / nights))} / night avg.
                                </span>
                              </span>
                            </button>
                          </m.li>
                        );
                      })}
                    </ul>
                  )}
                  <div>
                    <button type="button" onClick={() => go({ step: 1 })} className={buttonVariants({ variant: "line", size: "cta" })}>
                      Back
                    </button>
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <h1 id="step-title" className="font-display m-0 text-[40px] min-[760px]:text-[48px]">
                    Your details
                  </h1>
                  <DetailsForm value={details} onChange={(d) => { setDetails(d); if (Object.keys(errors).length) setErrors(validateDetails(d)); }} errors={errors} />
                  <p className="m-0 text-sm text-muted-foreground">
                    We use these details only for your stay. See our <Link href="/privacy">privacy notice</Link>.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => go({ step: 2 })} className={buttonVariants({ variant: "line", size: "cta" })}>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const errs = validateDetails(details);
                        setErrors(errs);
                        if (Object.keys(errs).length === 0) go({ step: 4 });
                        else document.getElementById(`bd-${Object.keys(errs)[0]}`)?.focus();
                      }}
                      className={buttonVariants({ variant: "amber", size: "cta" })}
                    >
                      Review booking
                    </button>
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <h1 id="step-title" className="font-display m-0 text-[40px] min-[760px]:text-[48px]">
                    Review and reserve
                  </h1>
                  <div className="flex items-start gap-4 border border-amber bg-[#FFFBF7] p-5 shadow-[inset_0_0_0_1px_var(--color-amber)]">
                    <span aria-hidden="true" className="mt-1 size-4 flex-none rounded-full border-[5px] border-amber" />
                    <span>
                      <strong>No payment now. Pay at the hotel.</strong>
                      <span className="mt-1 block text-sm text-body">
                        Your room is reserved the moment you confirm. Pay at the front desk on arrival by cash,
                        transfer or card. If you haven&rsquo;t arrived by {hotel.noShowCutoff} on your arrival day and
                        haven&rsquo;t called us, the room may be released.
                      </span>
                    </span>
                  </div>
                  <dl className="m-0 border border-line bg-paper px-5 text-sm">
                    {(
                      [
                        ["Guest", `${details.firstName} ${details.lastName}`],
                        ["Email", details.email],
                        ["Phone", details.phone],
                        ["Room", chosen?.name ?? ""],
                        ["Dates", `${formatDate(checkIn)} to ${formatDate(checkOut)} · ${plural(nights, "night")}`],
                        ["Guests", formatParty(adults, children)],
                        ["Arrival", details.arrivalWindow],
                        ["Special requests", details.specialRequests.trim()],
                        ["Total due at the hotel", chosen ? formatNaira(chosen.total) : ""],
                      ] as [string, string][]
                    )
                      .filter(([, v]) => v)
                      .map(([k, v], i) => (
                        <div key={k} className={cn("grid grid-cols-1 gap-1 py-3 min-[560px]:grid-cols-[180px_1fr] min-[560px]:gap-6", i > 0 && "border-t border-line")}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="m-0 break-words">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  {hotel.cancellationPolicy ? <p className="m-0 text-sm text-body">{hotel.cancellationPolicy}</p> : null}
                  <label className="flex cursor-pointer items-start gap-3 text-[15px]">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => {
                        setAgreed(e.target.checked);
                        if (e.target.checked) setNotice(null);
                      }}
                      className="mt-1 size-5 flex-none accent-amber"
                    />
                    <span>
                      I agree to the <Link href="/terms" target="_blank">booking terms</Link> and cancellation policy.
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => go({ step: 3 })} className={buttonVariants({ variant: "line", size: "cta" })}>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={submitting || !chosen}
                      className={cn(buttonVariants({ variant: "amber", size: "cta" }), "min-w-[260px]")}
                    >
                      {submitting ? (
                        <>
                          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> Reserving…
                        </>
                      ) : (
                        "Reserve — pay at the hotel"
                      )}
                    </button>
                  </div>
                </>
              ) : null}

              {step === 5 ? <Confirmed confirmation={confirmation} hotel={hotel} /> : null}
            </m.section>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <nav aria-label="Booking progress">
      <ol className="m-0 flex list-none gap-1 overflow-x-auto p-0 min-[560px]:gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "relative flex flex-1 items-center gap-2 border-b-2 pb-3 text-sm whitespace-nowrap transition-colors duration-500",
                state === "todo" ? "border-line text-muted-foreground" : "border-amber text-ink",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 flex-none items-center justify-center rounded-full text-xs font-semibold transition-colors duration-500",
                  state === "done" ? "bg-amber text-white" : state === "current" ? "bg-ink text-white" : "bg-mist text-muted-foreground",
                )}
              >
                {state === "done" ? <CheckIcon className="size-3.5" aria-hidden="true" /> : n}
              </span>
              <span className={cn(state !== "current" && "hidden min-[760px]:inline")}>{label}</span>
              {state === "done" ? <span className="sr-only">(done)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Confirmed({ confirmation: c, hotel }: { confirmation: Confirmation | null; hotel: HotelInfo }) {
  if (!c) {
    return (
      <div className="flex flex-col gap-4 border border-line bg-paper p-8">
        <h1 id="step-title" className="font-display m-0 text-[40px]">
          Your booking
        </h1>
        <p className="m-0 text-body">
          Your confirmation email has the reference and a link to manage your booking. If you can&rsquo;t find it, call{" "}
          <a href={hotel.phone.href}>{hotel.phone.display}</a>.
        </p>
        <div>
          <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
            Make another booking
          </Link>
        </div>
      </div>
    );
  }
  const manage = `/booking/${c.ref}?t=${encodeURIComponent(c.token)}`;
  const ics = () =>
    downloadIcs(
      `selems-${c.ref}.ics`,
      stayIcs({
        ref: c.ref,
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        title: `Stay at ${hotel.name} (${c.ref})`,
        location: hotel.address,
        description: `${c.roomName}, ${plural(c.nights, "night")}. Booking ${c.ref}. Pay ${formatNaira(c.total)} at the hotel. Front office: ${hotel.phone.display}.`,
        url: `${window.location.origin}${manage}`,
      }),
    );

  return (
    <div className="flex flex-col gap-6 border border-line bg-paper p-6 min-[760px]:p-10">
      <m.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
        className="inline-flex size-14 items-center justify-center rounded-full bg-ok-bg text-ok"
      >
        <CheckIcon className="size-7" strokeWidth={2} aria-hidden="true" />
      </m.span>
      <h1 id="step-title" className="font-display m-0 text-[40px] min-[760px]:text-[52px]">
        You&rsquo;re booked, {c.firstName}.
      </h1>
      <p className="lede m-0">
        Booking reference <strong className="tabular-nums">{c.ref}</strong>. We&rsquo;ve emailed {c.email} with your
        confirmation and a link to manage your booking.
      </p>
      <dl className="m-0 text-[15px]">
        {(
          [
            ["Room", c.roomName],
            ["Dates", `${formatDate(c.checkIn)} – ${formatDate(c.checkOut)} · ${plural(c.nights, "night")}`],
            ["Guests", formatParty(c.adults, c.children)],
            ["Pay at the hotel", formatNaira(c.total)],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-t border-line py-3 last:border-b">
            <dt className="text-body">{k}</dt>
            <dd className="m-0 text-right font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={ics} className={buttonVariants({ variant: "line", size: "cta" })}>
          <CalendarPlusIcon className="size-4" aria-hidden="true" /> Add to calendar
        </button>
        <a href={hotel.mapsHref} target="_blank" rel="noopener" className={buttonVariants({ variant: "line", size: "cta" })}>
          <MapPinIcon className="size-4" aria-hidden="true" /> Get directions
        </a>
        {hotel.whatsapp ? (
          <a
            href={`${hotel.whatsapp.href}?text=${encodeURIComponent(`Hello Selems, my booking reference is ${c.ref}.`)}`}
            className={buttonVariants({ variant: "line", size: "cta" })}
          >
            <MessageCircleIcon className="size-4" aria-hidden="true" /> WhatsApp the front desk
          </a>
        ) : null}
        <Link href={manage} className={buttonVariants({ variant: "amber", size: "cta" })}>
          Manage booking
        </Link>
      </div>
    </div>
  );
}
