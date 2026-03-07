import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@officeplan.app"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (req: Request) => {
  // Accepts optional { schedule_type } body to target a specific schedule
  const { schedule_type } = await req.json().catch(() => ({}))

  try {
    // Fetch active schedules
    const { data: schedules, error: schedErr } = await supabase
      .from("notification_schedules")
      .select("*")
      .eq("active_flag", true)
      .eq(schedule_type ? "schedule_type" : "active_flag", schedule_type ?? true)

    if (schedErr) throw schedErr

    const results: { schedule: string; sent: number; errors: string[] }[] = []

    for (const schedule of schedules ?? []) {
      const sent: string[] = []
      const errors: string[] = []

      if (schedule.schedule_type === "weekly_digest" || schedule.schedule_type === "daily_digest") {
        const prefField = schedule.schedule_type === "weekly_digest" ? "weekly_digest" : "daily_digest"

        // Get opted-in users with upcoming bookings
        const { data: users } = await supabase
          .from("notification_preferences")
          .select("user_id, reminder_lead_days, users!inner(email, first_name, last_name)")
          .eq(prefField, true)

        for (const pref of users ?? []) {
          const user = pref.users as { email: string; first_name: string; last_name: string }
          const leadDays = pref.reminder_lead_days ?? 1
          const fromDate = new Date()
          const toDate = new Date(fromDate)
          toDate.setDate(toDate.getDate() + (schedule.schedule_type === "weekly_digest" ? 7 : leadDays))

          const { data: bookings } = await supabase
            .from("bookings")
            .select("booking_date, workspace_assets(code, name, floors(name, offices(name)))")
            .eq("user_id", pref.user_id)
            .in("status", ["confirmed", "pending_approval"])
            .gte("booking_date", fromDate.toISOString().slice(0, 10))
            .lte("booking_date", toDate.toISOString().slice(0, 10))
            .order("booking_date")

          if (!bookings?.length) continue

          const bookingRows = bookings.map((b) => {
            const asset = b.workspace_assets as { name?: string; code: string; floors?: { name: string; offices?: { name: string } } }
            return `<tr>
              <td style="padding:4px 8px">${b.booking_date}</td>
              <td style="padding:4px 8px">${asset?.name ?? asset?.code}</td>
              <td style="padding:4px 8px">${asset?.floors?.offices?.name ?? ""} / ${asset?.floors?.name ?? ""}</td>
            </tr>`
          }).join("")

          const html = `
            <h2>Hello ${user.first_name},</h2>
            <p>Here are your upcoming office bookings:</p>
            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
              <thead>
                <tr style="background:#f3f4f6">
                  <th style="padding:6px 8px;text-align:left">Date</th>
                  <th style="padding:6px 8px;text-align:left">Desk</th>
                  <th style="padding:6px 8px;text-align:left">Location</th>
                </tr>
              </thead>
              <tbody>${bookingRows}</tbody>
            </table>
            <p style="margin-top:16px;font-size:12px;color:#6b7280">
              You can manage your bookings at <a href="${SUPABASE_URL.replace('supabase.co', 'github.io')}">OfficePlan</a>.
            </p>
          `

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: RESEND_FROM,
              to: [user.email],
              subject: schedule.schedule_type === "weekly_digest"
                ? "Your office bookings this week"
                : "Your office booking reminder",
              html,
            }),
          })

          if (res.ok) {
            sent.push(user.email)
          } else {
            const err = await res.text()
            errors.push(`${user.email}: ${err}`)
          }
        }
      }

      // Update last_run_at
      await supabase
        .from("notification_schedules")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: errors.length === 0 ? "ok" : "partial_error",
        })
        .eq("id", schedule.id)

      // Audit log
      await supabase.from("audit_events").insert({
        entity_type: "notification_schedule",
        entity_id: schedule.id,
        action_type: "run",
        payload_json: { sent: sent.length, errors },
      })

      results.push({ schedule: schedule.schedule_type, sent: sent.length, errors })
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
