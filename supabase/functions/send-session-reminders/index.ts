import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function buildGoogleCalendarUrl(
  title: string,
  dateStr: string,
  startTime: string,
  endTime: string,
  meetingType: string
) {
  const start = `${dateStr.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
  const end = `${dateStr.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
  const details = meetingType === "online" ? "Online session" : "In-person session";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `SkillSwap: ${title}`,
    dates: `${start}/${end}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate: require the service role key or anon key as Bearer token
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Only allow calls authenticated with the service role key or anon key (from pg_cron/scheduler)
    const token = authHeader?.replace("Bearer ", "");
    if (token !== serviceRoleKey && token !== anonKey) {
      // If a user JWT is provided, verify they are an admin
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find sessions happening in ~1 hour that haven't been reminded
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const laterTime = oneHourLater.toTimeString().slice(0, 5);

    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("scheduled_date", todayStr)
      .eq("reminder_sent", false)
      .in("status", ["pending", "accepted"])
      .gte("start_time", currentTime)
      .lte("start_time", laterTime);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sessions?.length) {
      return new Response(JSON.stringify({ message: "No reminders to send", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const session of sessions) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", [session.teacher_id, session.learner_id]);

      if (!profiles?.length) continue;

      const teacher = profiles.find((p: any) => p.user_id === session.teacher_id);
      const learner = profiles.find((p: any) => p.user_id === session.learner_id);

      const calendarUrl = buildGoogleCalendarUrl(
        session.skill_name,
        session.scheduled_date,
        session.start_time,
        session.end_time,
        session.meeting_type
      );

      console.log(`📧 Reminder for session ${session.id}:`);
      console.log(`  Teacher: ${teacher?.name}`);
      console.log(`  Learner: ${learner?.name}`);
      console.log(`  Skill: ${session.skill_name}`);
      console.log(`  Time: ${session.start_time} - ${session.end_time}`);

      await supabase
        .from("sessions")
        .update({ reminder_sent: true })
        .eq("id", session.id);

      sentCount++;
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} reminders`, count: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
