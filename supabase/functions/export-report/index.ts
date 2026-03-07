import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/** GET /export-report?report=utilisation&office_id=... */
Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const report = url.searchParams.get("report") ?? "utilisation"
  const officeId = url.searchParams.get("office_id")

  let rows: object[] = []
  let filename = "report.csv"

  try {
    if (report === "utilisation") {
      let q = supabase.from("v_utilisation").select("*")
      const { data, error } = await q
      if (error) throw error
      rows = data ?? []
      filename = "utilisation.csv"
    } else if (report === "occupancy") {
      const from = url.searchParams.get("from") ?? new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
      const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10)
      let q = supabase.from("v_daily_occupancy").select("*").gte("booking_date", from).lte("booking_date", to)
      if (officeId) q = q.eq("office_id", officeId)
      const { data, error } = await q
      if (error) throw error
      rows = data ?? []
      filename = "daily-occupancy.csv"
    } else if (report === "approvals") {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("id, request_type, status, rationale, decision_notes, decided_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1000)
      if (error) throw error
      rows = data ?? []
      filename = "approvals.csv"
    }

    if (!rows.length) {
      return new Response("No data", { status: 204 })
    }

    const keys = Object.keys(rows[0])
    const csv = [
      keys.join(","),
      ...rows.map(r =>
        keys.map(k => JSON.stringify((r as Record<string, unknown>)[k] ?? "")).join(",")
      ),
    ].join("\n")

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
