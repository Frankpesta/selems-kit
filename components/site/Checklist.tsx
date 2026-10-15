import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checklist({ items, columns = 2, className }: { items: string[]; columns?: 1 | 2; className?: string }) {
  return (
    <ul className={cn("m-0 grid list-none gap-x-8 p-0", columns === 2 && "min-[560px]:grid-cols-2", className)}>
      {items.map((it) => (
        <li key={it} className="flex items-start gap-3 border-t border-line py-3">
          <CheckIcon className="mt-0.5 size-5 flex-none text-amber" strokeWidth={1.75} aria-hidden="true" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
