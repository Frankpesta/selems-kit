import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { resend } from "./lib/email";

const http = httpRouter();

auth.addHttpRoutes(http);

// Resend delivery/bounce events. Point a Resend webhook (all email.* events) at
// https://<deployment>.convex.site/resend-webhook and set RESEND_WEBHOOK_SECRET.
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => resend.handleResendEventWebhook(ctx, req)),
});

export default http;
