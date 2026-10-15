import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Schema per docs/04. Additions beyond the original spec are marked "added"
// and recorded in docs/04 ("Schema changes during the build").

export const image = v.object({
  storageId: v.optional(v.id("_storage")), // admin uploads
  src: v.optional(v.string()), // seed photos under /public/images
  alt: v.string(), // required, non-empty
  width: v.number(),
  height: v.number(),
});

export const role = v.union(v.literal("admin"), v.literal("staff"));

export const bookingStatus = v.union(
  v.literal("reserved"),
  v.literal("checked_in"),
  v.literal("checked_out"),
  v.literal("cancelled"),
  v.literal("no_show"),
);

export const bookingSource = v.union(
  v.literal("website"),
  v.literal("phone"),
  v.literal("whatsapp"),
  v.literal("walk_in"),
  v.literal("email"),
  v.literal("other"),
);

export const bookingPurpose = v.union(
  v.literal("business"),
  v.literal("leisure"),
  v.literal("event"),
  v.literal("other"),
);

export const nightlyLine = v.object({ date: v.string(), rate: v.number(), reason: v.string() });

export const inquirySubject = v.union(
  v.literal("reservation"),
  v.literal("group"),
  v.literal("request"),
  v.literal("suggestion"),
  v.literal("testimony"),
  v.literal("complaint"),
);

export const galleryCategory = v.union(
  v.literal("rooms"),
  v.literal("suites"),
  v.literal("dining"),
  v.literal("bar"),
  v.literal("hotel"),
);

export default defineSchema({
  ...authTables,

  staffProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    role,
    active: v.boolean(),
    lastSignInAt: v.optional(v.number()), // added: Staff list shows last sign-in (docs/06)
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  invites: defineTable({
    email: v.string(),
    name: v.optional(v.string()), // added: bootstrapAdmin/invite can carry the person's name
    role,
    invitedBy: v.optional(v.id("users")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  settings: defineTable({
    key: v.literal("hotel"),
    hotelName: v.string(),
    address: v.object({
      street: v.string(),
      locality: v.string(),
      region: v.string(),
      country: v.string(),
      postalCode: v.optional(v.string()),
    }),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    phones: v.array(v.object({ label: v.string(), number: v.string(), whatsapp: v.boolean() })),
    emails: v.object({ booking: v.string(), info: v.string() }),
    checkInTime: v.optional(v.string()), // "14:00"; unset = hide on site
    checkOutTime: v.optional(v.string()),
    noShowCutoff: v.string(), // "20:00"
    autoCancelNoShows: v.boolean(),
    cancellationPolicy: v.optional(v.string()),
    freeCancellationHours: v.optional(v.number()),
    childrenPolicy: v.optional(v.string()),
    taxNote: v.optional(v.string()),
    maxNights: v.number(),
    bookingWindowDays: v.number(),
    socials: v.object({
      facebook: v.optional(v.string()),
      instagram: v.optional(v.string()),
      x: v.optional(v.string()),
      tiktok: v.optional(v.string()),
    }),
    googleBusinessUrl: v.optional(v.string()),
    googleReviewUrl: v.optional(v.string()),
    mapEmbedUrl: v.optional(v.string()),
    gbpNap: v.optional(v.string()), // added: NAP as entered on Google Business Profile, for the SEO health check (docs/06)
    staffAlertEmails: v.optional(v.array(v.string())), // added: "alert recipients" in Settings (docs/06); env STAFF_ALERT_EMAILS is the fallback
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  roomTypes: defineTable({
    name: v.string(),
    slug: v.string(),
    slugRedirects: v.optional(v.array(v.string())), // added: old slugs served as 308s (docs/06)
    category: v.union(v.literal("room"), v.literal("suite")),
    sortOrder: v.number(),
    featured: v.boolean(), // added: Home "featured rooms" (docs/05, seed.json)
    shortDescription: v.string(),
    description: v.string(),
    facts: v.array(v.string()),
    amenities: v.array(v.string()),
    maxAdults: v.number(),
    maxChildren: v.number(),
    sizeSqm: v.optional(v.number()),
    baseRate: v.number(), // kobo per night
    weekendRate: v.optional(v.number()), // kobo, Friday and Saturday nights
    images: v.array(image), // first = cover
    published: v.boolean(),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_sort", ["sortOrder"]),

  rooms: defineTable({
    number: v.string(),
    roomTypeId: v.id("roomTypes"),
    floor: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("out_of_service")),
    notes: v.optional(v.string()),
  })
    .index("by_type", ["roomTypeId"])
    .index("by_number", ["number"]),

  rateOverrides: defineTable({
    roomTypeId: v.id("roomTypes"),
    startDate: v.string(), // first night
    endDate: v.string(), // last night (inclusive)
    rate: v.number(), // kobo
    label: v.string(),
  }).index("by_type_start", ["roomTypeId", "startDate"]),

  occupancy: defineTable({
    roomId: v.id("rooms"),
    date: v.string(), // the night
    bookingId: v.optional(v.id("bookings")),
    blockId: v.optional(v.id("blocks")),
  })
    .index("by_date", ["date"])
    .index("by_room_date", ["roomId", "date"])
    .index("by_booking", ["bookingId"])
    .index("by_block", ["blockId"]),

  blocks: defineTable({
    roomId: v.id("rooms"),
    startDate: v.string(),
    endDate: v.string(), // [start, end)
    reason: v.union(
      v.literal("maintenance"),
      v.literal("event"),
      v.literal("owner_use"),
      v.literal("other"),
    ),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_room", ["roomId"]),

  bookings: defineTable({
    ref: v.string(), // "SLM-26-0418"
    roomTypeId: v.id("roomTypes"),
    roomId: v.id("rooms"),
    checkIn: v.string(),
    checkOut: v.string(),
    nights: v.number(),
    adults: v.number(),
    children: v.number(),
    guest: v.object({
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      phone: v.string(),
    }),
    arrivalWindow: v.optional(v.string()),
    purpose: v.optional(bookingPurpose),
    specialRequests: v.optional(v.string()),
    source: bookingSource,
    status: bookingStatus,
    lateArrivalFlag: v.optional(v.boolean()),
    nightly: v.array(nightlyLine),
    offerId: v.optional(v.id("offers")),
    amountDue: v.number(), // kobo
    amountPaid: v.number(), // kobo
    paymentStatus: v.union(v.literal("unpaid"), v.literal("part_paid"), v.literal("paid")),
    manageTokenHash: v.string(),
    createdBy: v.optional(v.id("users")), // undefined = website
    cancelledReason: v.optional(v.string()),
    viewedAt: v.optional(v.number()), // added: "website bookings not yet viewed" on Today (docs/06)
    searchText: v.string(), // lower-cased "first last phone ref"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ref", ["ref"])
    .index("by_checkIn", ["checkIn"])
    .index("by_status_checkIn", ["status", "checkIn"])
    .index("by_checkOut", ["checkOut"])
    .index("by_status_checkOut", ["status", "checkOut"]) // added: reviewRequests cron, departures
    .index("by_email", ["guest.email"])
    .searchIndex("search_guest", { searchField: "searchText", filterFields: ["status"] }),

  payments: defineTable({
    bookingId: v.id("bookings"),
    amount: v.number(),
    method: v.union(v.literal("cash"), v.literal("transfer"), v.literal("pos"), v.literal("other")),
    note: v.optional(v.string()),
    receivedBy: v.id("users"),
    at: v.number(),
  }).index("by_booking", ["bookingId"]),

  bookingEvents: defineTable({
    bookingId: v.id("bookings"),
    type: v.string(),
    message: v.string(),
    by: v.optional(v.id("users")),
    at: v.number(),
  }).index("by_booking", ["bookingId"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  offers: defineTable({
    title: v.string(),
    slug: v.string(),
    summary: v.string(),
    description: v.optional(v.string()),
    nights: v.number(),
    priceTotal: v.number(), // kobo for the whole stay
    roomTypeIds: v.array(v.id("roomTypes")),
    arrivalWeekdays: v.optional(v.array(v.number())), // 0=Sun … 6=Sat
    validFrom: v.string(),
    validTo: v.string(),
    image: v.optional(image),
    terms: v.optional(v.string()),
    showOnHome: v.boolean(),
    published: v.boolean(),
    updatedAt: v.optional(v.number()), // added: sitemap lastModified (docs/07)
  }).index("by_slug", ["slug"]),

  pages: defineTable({
    key: v.string(),
    fields: v.any(), // shape validated per key by lib/content-schemas.ts
    draftFields: v.optional(v.any()), // added: unpublished edits for preview (docs/06)
    seoTitle: v.string(),
    seoDescription: v.string(),
    ogImage: v.optional(image),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  faqs: defineTable({
    question: v.string(),
    answer: v.string(),
    pages: v.array(v.string()),
    sortOrder: v.number(),
    published: v.boolean(),
  }).index("by_question", ["question"]), // added index: idempotent seeding

  facilities: defineTable({
    title: v.string(),
    body: v.string(),
    icon: v.string(),
    eyebrow: v.optional(v.string()),
    image: v.optional(image),
    sortOrder: v.number(),
    published: v.boolean(),
  }).index("by_title", ["title"]), // added index: idempotent seeding

  galleryImages: defineTable({
    image,
    caption: v.string(),
    category: galleryCategory,
    roomTypeId: v.optional(v.id("roomTypes")),
    sortOrder: v.number(),
    published: v.boolean(),
  })
    .index("by_category", ["category", "sortOrder"])
    .index("by_src", ["image.src"]), // added index: idempotent seeding

  reviews: defineTable({
    source: v.union(v.literal("google"), v.literal("email"), v.literal("website")),
    authorName: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.string(),
    stayMonth: v.optional(v.string()),
    bookingId: v.optional(v.id("bookings")),
    approved: v.boolean(),
    featured: v.boolean(),
    createdAt: v.number(),
  }),

  inquiries: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: inquirySubject,
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("replied"), v.literal("closed")),
    notes: v.optional(v.string()), // added: internal notes (docs/06)
    createdAt: v.number(),
  }).index("by_status", ["status", "createdAt"]),

  auditLog: defineTable({
    actor: v.id("users"),
    action: v.string(),
    entity: v.string(),
    entityId: v.string(),
    summary: v.string(),
    at: v.number(),
  }).index("by_entity", ["entity", "entityId"]),
});
