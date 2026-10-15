import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import manifest from "@/content/images.json";

export const metadata: Metadata = { title: "Staff sign-in" };

const PHOTO = "/images/selems-hotel-akure-corridor-chandelier.jpg";
const photo = (manifest as Record<string, { alt: string; width: number; height: number }>)[PHOTO];

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-wrap bg-stone">
      <div className="relative min-h-60 flex-[1_1_520px] overflow-hidden bg-ink">
        <Image src={PHOTO} alt={photo.alt} fill sizes="(min-width: 1000px) 50vw, 100vw" className="object-cover opacity-55" priority />
        <div className="relative flex h-full flex-col justify-between gap-8 p-8 text-stone md:p-12">
          <p className="m-0 font-display text-[28px] text-stone">
            Selems <span className="block font-sans text-xs font-semibold tracking-[0.18em] text-amber-tint uppercase">Hotel admin</span>
          </p>
          <p className="m-0 max-w-[14ch] font-display text-[40px] text-stone">Bookings, rooms and prices in one place.</p>
        </div>
      </div>
      <main className="flex flex-[1_1_480px] items-center justify-center px-6 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
