import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const RESEND_FROM    = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@officeplan.app"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } })
  }

  try {
    const { email } = await req.json() as { email: string }
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400 })

    // Admin client (uses service role key — always available in edge functions)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Generate a magic-link for the invited user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    })
    if (linkError) throw linkError

    const magicLink = linkData?.properties?.action_link ?? ""

    // Send via Resend
    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [email],
          subject: "You've been invited to OfficePlan",
          html: `
            <p>Hi there,</p>
            <p>You've been invited to join <strong>OfficePlan</strong> — your team's workplace booking platform.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <p style="margin: 24px 0;">
              <a href="${magicLink}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Accept Invitation
              </a>
            </p>
            <p style="font-size:12px;color:#6b7280;">This link expires in 24 hours. If you didn't expect this email, you can safely ignore it.</p>
          `,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error("Resend error:", body)
      }
    } else {
      console.warn("RESEND_API_KEY not set — skipping email send")
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("invite-user error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
