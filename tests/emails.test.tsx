import { describe, expect, it } from "vitest";
import { render } from "react-email";
import { BookingConfirmation } from "../emails/BookingConfirmation";
import { StaffNewBooking } from "../emails/StaffNewBooking";
import { BookingCancelled } from "../emails/BookingCancelled";
import type { BookingEmailModel } from "../emails/model";

const m: BookingEmailModel = {
  hotel: {
    name: "Selems Exclusive Hotel & Suites",
    address: "Atibiti Layout, Ijapo Extension, Akure, Ondo State",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Selems",
    phone: "+234 903 155 9943",
    phoneHref: "tel:+2349031559943",
    whatsappHref: "https://wa.me/2348147744484",
    bookingEmail: "booking@selemsexclusivehotel.com",
    siteUrl: "https://selemsexclusivehotel.com",
    logoUrl: "https://selemsexclusivehotel.com/images/selems-logo.png",
  },
  ref: "SLM-26-0418",
  guestFirstName: "Ada",
  guestFullName: "Ada Obi",
  guestEmail: "ada@example.com",
  guestPhone: "+234 803 123 4567",
  roomName: "VIP Suite",
  checkIn: "Tue 20 Oct 2026",
  checkOut: "Thu 22 Oct 2026",
  nights: "2 nights",
  party: "2 adults",
  priceLines: [{ label: "₦70,000 × 2 nights", amount: "₦140,000" }],
  offerTitle: null,
  totalDue: "₦140,000",
  checkInTime: null,
  checkOutTime: "12:00 pm",
  cancellationPolicy: null,
  arrivalWindow: "After 6 pm",
  specialRequests: null,
  manageUrl: "https://selemsexclusivehotel.com/booking/SLM-26-0418?t=abc_DEF-123",
  adminUrl: "https://selemsexclusivehotel.com/admin/reservations/xyz",
};

describe("booking emails", () => {
  it("confirmation shows everything the guest needs (docs/04) and hides unset values", async () => {
    const html = await render(<BookingConfirmation m={m} />);
    for (const s of ["SLM-26-0418", "VIP Suite", "Tue 20 Oct 2026", "Thu 22 Oct 2026, by 12:00 pm", "2 adults", "₦140,000", "After 6 pm", "Ijapo Extension", "tel:+2349031559943", "https://wa.me/2348147744484"]) {
      expect(html).toContain(s);
    }
    expect(html).toContain('href="https://selemsexclusivehotel.com/booking/SLM-26-0418?t=abc_DEF-123"');
    expect(html).not.toMatch(/undefined|null|\[CONFIRM/);
    expect(html).not.toContain("Cancellation policy");
    expect(html).not.toContain("/admin/");
  });

  it("has a plain-text version", async () => {
    const text = await render(<BookingConfirmation m={m} />, { plainText: true });
    expect(text).toContain("SLM-26-0418");
    expect(text).toContain("₦140,000");
    expect(text).not.toContain("<");
  });

  it("staff alert links to admin and includes guest contacts", async () => {
    const html = await render(<StaffNewBooking m={m} />);
    expect(html).toContain("https://selemsexclusivehotel.com/admin/reservations/xyz");
    expect(html).toContain("ada@example.com");
    expect(html).not.toContain("?t=");
  });

  it("cancellation differs for guest and staff", async () => {
    const guest = await render(<BookingCancelled m={m} audience="guest" />);
    const staff = await render(<BookingCancelled m={m} audience="staff" />);
    expect(guest).toContain("Your booking is cancelled, Ada.");
    expect(guest).not.toContain("/admin/");
    expect(staff).toContain("Ada Obi cancelled SLM-26-0418");
    expect(staff).toContain("/admin/reservations/xyz");
  });
});
