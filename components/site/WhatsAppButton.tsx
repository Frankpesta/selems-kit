// Floating WhatsApp link, desktop only (phones have the bottom book bar). docs/05.
export function WhatsAppButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="WhatsApp the front desk"
      className="animate-pop-in fixed right-6 bottom-6 z-30 hidden size-14 items-center justify-center rounded-full bg-[#1F6A3A] text-white shadow-[0_10px_30px_-8px_rgba(15,23,30,.5)] transition-transform hover:scale-105 hover:text-white min-[760px]:inline-flex"
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3a8.2 8.2 0 1 1 6.9 3.8Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2-.2-.2-.5-.3Z" />
      </svg>
    </a>
  );
}
