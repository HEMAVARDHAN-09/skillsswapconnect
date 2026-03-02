import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");
    if (user_id === caller.id) throw new Error("Cannot delete yourself");

    // Delete related data first (cascade may not cover everything)
    await adminClient.from("chat_messages").delete().eq("sender_id", user_id);
    await adminClient.from("blocked_users").delete().or(`blocker_id.eq.${user_id},blocked_id.eq.${user_id}`);
    await adminClient.from("reports").delete().or(`reporter_id.eq.${user_id},reported_id.eq.${user_id}`);
    
    // Delete chat rooms where user is participant
    await adminClient.from("chat_rooms").delete().or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`);
    
    // Delete sessions
    await adminClient.from("sessions").delete().or(`teacher_id.eq.${user_id},learner_id.eq.${user_id}`);
    
    // Delete skills, profile, roles
    await adminClient.from("skills").delete().eq("user_id", user_id);
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("user_id", user_id);

    // Delete auth user
    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
