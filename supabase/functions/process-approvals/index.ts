import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@locustworks.app"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/** Called by the fn_decide_approval trigger or directly after an approval decision
 *  Body: { approval_request_id: string }
 */
Deno.serve(async (req: Request) => {
  const { approval_request_id } = await req.json()
  if (!approval_request_id) {
    return new Response(JSON.stringify({ error: "approval_request_id required" }), { status: 400 })
  }

  const { data: request, error } = await supabase
    .from("approval_requests")
    .select(`
      *,
      requester: users!requester_user_id (email, first_name),
      bookings (booking_date, workspace_assets (code, name))
    `)
    .eq("id", approval_request_id)
    .single()

  if (error || !request) {
    return new Response(JSON.stringify({ error: "Request not found" }), { status: 404 })
  }

  const requester = request.requester as { email: string; first_name: string }
  const booking = request.bookings as { booking_date?: string; workspace_assets?: { code: string; name?: string } }
  const isApproved = request.status === "approved"
  const assetLabel = booking?.workspace_assets?.name ?? booking?.workspace_assets?.code ?? "your desk"
  const dateLabel = booking?.booking_date ?? "the requested date"

  const html = `
    <h2>Hello ${requester.first_name},</h2>
    <p>Your booking request for <strong>${assetLabel}</strong> on <strong>${dateLabel}</strong>
    has been <strong style="color:${isApproved ? "#16a34a" : "#dc2626"}">${isApproved ? "approved" : "rejected"}</strong>.</p>
    ${request.decision_notes ? `<p><em>Notes: ${request.decision_notes}</em></p>` : ""}
    <p style="font-size:12px;color:#6b7280">This is a mandatory notification. You cannot opt out of approval outcome messages.</p>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [requester.email],
      subject: `Booking request ${isApproved ? "approved" : "rejected"} — ${assetLabel}`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), { status: 502 })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
})
