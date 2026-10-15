import type { ContactLinks } from "./nav";

// 38px strip above the header (docs/02). Scrolls away; not sticky.
export function UtilityBar({ address, contact }: { address: string; contact: ContactLinks }) {
  return (
    <div className="bg-ink-2 text-[13px] text-[#AEBBC3]">
      <div className="container-site flex min-h-[38px] items-center justify-end gap-4 whitespace-nowrap min-[720px]:justify-between">
        <span className="hidden min-[720px]:inline">{address}</span>
        <span className="flex items-center gap-[22px]">
          <span className="hidden min-[720px]:inline">Front office open 24/7</span>
          <span aria-hidden="true" className="hidden h-3.5 w-px bg-white/20 min-[720px]:inline-block" />
          <a href={contact.phoneHref} className="text-[#E6EAEC] no-underline tabular-nums hover:text-amber-tint">
            {contact.phone}
          </a>
          {contact.whatsappHref ? (
            <>
              <span aria-hidden="true" className="inline-block h-3.5 w-px bg-white/20" />
              <a href={contact.whatsappHref} className="text-[#E6EAEC] no-underline hover:text-amber-tint">
                WhatsApp
              </a>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
