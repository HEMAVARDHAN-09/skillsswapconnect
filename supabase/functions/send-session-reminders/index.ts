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
  // dateStr = "2026-03-01", startTime/endTime = "14:00"
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      return new Response(JSON.stringify({ error: error.message }), {
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
      // Get participant profiles
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

      // Log reminder (in production, integrate with an email provider)
      console.log(`📧 Reminder for session ${session.id}:`);
      console.log(`  Teacher: ${teacher?.name} (${teacher?.email})`);
      console.log(`  Learner: ${learner?.name} (${learner?.email})`);
      console.log(`  Skill: ${session.skill_name}`);
      console.log(`  Time: ${session.start_time} - ${session.end_time}`);
      console.log(`  Google Calendar: ${calendarUrl}`);

      // Mark as reminded
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
