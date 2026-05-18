import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Plus, Coins, BookOpen, GraduationCap, Star, Trophy, Loader2, Trash2, Check, X, MessageSquare, Users, MessageCircle, CalendarIcon, Video } from "lucide-react";
import ReportUserDialog from "@/components/ReportUserDialog";
import { Textarea } from "@/components/ui/textarea";
import { ScheduleSessionDialog } from "@/components/ScheduleSessionDialog";
import { format } from "date-fns";
import SEO from "@/components/SEO";

type Skill = { id: string; user_id: string; skill_name: string; level: string; type: string; mode: string };
type Match = { user_id: string; name: string; skill_name: string; level: string; mode: string };
type SessionRow = {
  id: string; teacher_id: string; learner_id: string; skill_name: string;
  status: string; rating: number | null; review: string | null; created_at: string;
};
type LeaderboardEntry = { user_id: string; name: string; credits: number; avg_rating: number };

const Dashboard = () => {
  const { user, profile, signOut, refreshProfile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sessionProfiles, setSessionProfiles] = useState<Record<string, string>>({});
  const [chatRoomMap, setChatRoomMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Add skill form
  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [skillType, setSkillType] = useState("Teach");
  const [skillMode, setSkillMode] = useState("Online");

  // Rating
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");

  // Scheduling
  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    loadData();
  }, [user, authLoading]);

  // Realtime subscription: auto-refresh sessions when teacher accepts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dashboard-sessions-${user.id}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        loadSessions();
        loadChatRooms();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([loadSkills(), loadMatches(), loadSessions(), loadLeaderboard(), loadChatRooms()]);
    await refreshProfile();
    setLoading(false);
  };

  const loadSkills = async () => {
    const { data } = await supabase.from("skills").select("*").eq("user_id", user!.id);
    setSkills(data || []);
  };

  const loadMatches = async () => {
    if (!user) return;
    // Get user's learn skills
    const { data: myLearns } = await supabase.from("skills").select("skill_name").eq("user_id", user.id).eq("type", "Learn");
    if (!myLearns?.length) { setMatches([]); return; }
    const learnNames = myLearns.map((s) => s.skill_name);
    // Find teachers for those skills
    const { data: teacherSkills } = await supabase.from("skills").select("user_id, skill_name, level, mode").eq("type", "Teach").in("skill_name", learnNames).neq("user_id", user.id);
    if (!teacherSkills?.length) { setMatches([]); return; }
    const uids = [...new Set(teacherSkills.map((s) => s.user_id))];
    const { data: profiles } = await (supabase as any).rpc("get_public_profiles", { _user_ids: uids });
    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => (nameMap[p.user_id] = p.name));
    setMatches(teacherSkills.map((s) => ({ ...s, name: nameMap[s.user_id] || "Unknown" })));
  };

  const loadSessions = async () => {
    if (!user) return;
    const { data } = await supabase.from("sessions").select("*").or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).order("created_at", { ascending: false });
    setSessions(data || []);
    // Load profiles for session participants
    if (data?.length) {
      const ids = [...new Set(data.flatMap((s) => [s.teacher_id, s.learner_id]))];
      const { data: profs } = await (supabase as any).rpc("get_public_profiles", { _user_ids: ids });
      const map: Record<string, string> = {};
      profs?.forEach((p) => (map[p.user_id] = p.name));
      setSessionProfiles(map);
    }
  };

  const loadChatRooms = async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_rooms").select("id, session_id").or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    const map: Record<string, string> = {};
    data?.forEach((r) => { map[r.session_id] = r.id; });
    setChatRoomMap(map);
  };

  const loadLeaderboard = async () => {
    const { data: profiles } = await (supabase as any).rpc("get_leaderboard", { _limit: 5 });
    setLeaderboard((profiles || []).map((p: any) => ({ ...p, avg_rating: Number(p.avg_rating) || 0 })));
  };

  const addSkill = async () => {
    if (!skillName.trim()) { toast.error("Enter a skill name"); return; }
    const { error } = await supabase.from("skills").insert({ user_id: user!.id, skill_name: skillName.trim(), level: skillLevel, type: skillType, mode: skillMode });
    if (error) { toast.error(error.message); return; }
    toast.success("Skill added!");
    setSkillName("");
    await loadData();
  };

  const deleteSkill = async (id: string) => {
    await supabase.from("skills").delete().eq("id", id);
    toast.success("Skill removed");
    await loadSkills();
  };

  const openScheduleDialog = (match: Match) => {
    if (!profile || profile.credits < 1) { toast.error("Not enough credits! Teach a session to earn more."); return; }
    setScheduleMatch(match);
  };

  const bookSession = async (details: {
    scheduled_date: string;
    start_time: string;
    end_time: string;
    meeting_type: string;
  }) => {
    if (!scheduleMatch) return;
    const { error } = await supabase.from("sessions").insert({
      teacher_id: scheduleMatch.user_id,
      learner_id: user!.id,
      skill_name: scheduleMatch.skill_name,
      scheduled_date: details.scheduled_date,
      start_time: details.start_time,
      end_time: details.end_time,
      meeting_type: details.meeting_type,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Session request sent!");
    setScheduleMatch(null);
    await loadData();
  };

  const updateSession = async (sessionId: string, status: string) => {
    const { error } = status === "completed"
      ? await (supabase as any).rpc("complete_session", { _session_id: sessionId })
      : await supabase.from("sessions").update({ status }).eq("id", sessionId);
    if (error) { toast.error(error.message); return; }
    if (status === "accepted") {
      // Auto-create chat room
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        const { error: chatErr } = await supabase.from("chat_rooms").insert({
          session_id: sessionId,
          user1_id: session.teacher_id,
          user2_id: session.learner_id,
        });
        if (chatErr && !chatErr.message.includes("duplicate")) {
          console.error("Chat room creation error:", chatErr);
        }
      }
    }
    toast.success(`Session ${status}!`);
    await loadData();
  };

  const submitRating = async () => {
    if (!ratingSessionId) return;
    const { error } = await supabase.from("sessions").update({ rating: ratingValue, review: reviewText }).eq("id", ratingSessionId);
    if (error) { toast.error(error.message); return; }
    toast.success("Rating submitted!");
    setRatingSessionId(null);
    setReviewText("");
    await loadData();
  };

  if (!user || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );

  const teachSkills = skills.filter((s) => s.type === "Teach");
  const learnSkills = skills.filter((s) => s.type === "Learn");

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Dashboard — SkillSwap"
        description="Manage your skills, find skill matches, schedule sessions, and track your credits on SkillSwap."
        path="/dashboard"
      />
      <h1 className="sr-only">SkillSwap dashboard</h1>
      {/* Top bar */}
      <nav className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold gradient-text">SkillSwap</Link>
          <div className="flex items-center gap-3">
            {isAdmin && <Link to="/admin"><Button variant="outline" size="sm">Admin</Button></Link>}
            <Link to="/about"><Button variant="ghost" size="sm">About</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Logout</Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <h2 className="sr-only">Your profile and credits</h2>
        {/* Profile + Credits */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass-card hover-lift md:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  {profile?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{profile?.name || "Student"}</h3>
                  <p className="text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card hover-lift">
            <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-accent" /> Credits</CardTitle></CardHeader>
            <CardContent>
              <div className="text-5xl font-bold gradient-text">{profile?.credits ?? 0}</div>
              <p className="text-sm text-muted-foreground mt-1">Teach to earn more!</p>
            </CardContent>
          </Card>
        </div>

        {/* Add Skill */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add a Skill</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-5 gap-3">
              <Input aria-label="Skill name" placeholder="Skill name (e.g. Python)" value={skillName} onChange={(e) => setSkillName(e.target.value)} />
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger aria-label="Skill level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Select value={skillType} onValueChange={setSkillType}>
                <SelectTrigger aria-label="Skill type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teach">Teach</SelectItem>
                  <SelectItem value="Learn">Learn</SelectItem>
                </SelectContent>
              </Select>
              <Select value={skillMode} onValueChange={setSkillMode}>
                <SelectTrigger aria-label="Skill mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addSkill} className="gradient-primary">Add</Button>
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="glass-card hover-lift">
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Skills I Teach ({teachSkills.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {teachSkills.length === 0 ? <p className="text-muted-foreground text-sm">No teaching skills yet.</p> : teachSkills.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div>
                    <span className="font-medium">{s.skill_name}</span>
                    <span className="text-xs ml-2 text-muted-foreground">{s.level} · {s.mode}</span>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${s.skill_name}`} onClick={() => deleteSkill(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="glass-card hover-lift">
            <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-accent" /> Skills I Want to Learn ({learnSkills.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {learnSkills.length === 0 ? <p className="text-muted-foreground text-sm">No learning skills yet.</p> : learnSkills.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div>
                    <span className="font-medium">{s.skill_name}</span>
                    <span className="text-xs ml-2 text-muted-foreground">{s.level} · {s.mode}</span>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${s.skill_name}`} onClick={() => deleteSkill(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Matches */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Suggested Matches</CardTitle></CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-muted-foreground text-sm">Add skills you want to learn to see matches!</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map((m, i) => (
                  <div key={i} className="p-4 rounded-xl bg-secondary/50 hover-lift">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground">{m.name.charAt(0)}</div>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">teaches {m.skill_name}</p>
                        </div>
                      </div>
                      <ReportUserDialog reportedUserId={m.user_id} reportedUserName={m.name} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{m.level} · {m.mode}</p>
                    <Button size="sm" className="w-full gradient-primary" onClick={() => openScheduleDialog(m)}>
                      <CalendarIcon className="h-3 w-3 mr-1" /> Schedule Session
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> My Sessions</CardTitle></CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const isTeacher = s.teacher_id === user!.id;
                  const otherUserId = isTeacher ? s.learner_id : s.teacher_id;
                  const otherName = sessionProfiles[otherUserId] || "Unknown";
                  return (
                    <div key={s.id} className="p-4 rounded-xl bg-secondary/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{s.skill_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {isTeacher ? `Teaching ${otherName}` : `Learning from ${otherName}`} · <span className={`font-medium ${s.status === "completed" ? "text-green-600" : s.status === "confirmed" ? "text-emerald-500" : s.status === "rejected" ? "text-destructive" : "text-primary"}`}>{s.status}</span>
                        </p>
                        {(s as any).scheduled_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📅 {format(new Date((s as any).scheduled_date), "PPP")} · 🕐 {(s as any).start_time?.slice(0, 5)} – {(s as any).end_time?.slice(0, 5)} · 📍 {(s as any).meeting_type === "in_person" ? "In Person" : "Online"}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        {s.status === "pending" && isTeacher && (
                          <>
                            <Button size="sm" onClick={() => updateSession(s.id, "accepted")}><Check className="h-3 w-3 mr-1" /> Accept</Button>
                            <Button size="sm" variant="destructive" onClick={() => updateSession(s.id, "rejected")}><X className="h-3 w-3 mr-1" /> Reject</Button>
                          </>
                        )}
                        {s.status === "accepted" && isTeacher && (
                          <Button size="sm" className="gradient-primary" onClick={() => updateSession(s.id, "confirmed")}>
                            <CalendarIcon className="h-3 w-3 mr-1" /> Confirm Schedule
                          </Button>
                        )}
                        {s.status === "accepted" && !isTeacher && (
                          <span className="text-xs text-muted-foreground italic">Awaiting schedule confirmation…</span>
                        )}
                        {s.status === "confirmed" && (
                          <Button size="sm" className="gradient-primary" onClick={() => updateSession(s.id, "completed")}><Check className="h-3 w-3 mr-1" /> Complete</Button>
                        )}
                        {s.status === "confirmed" && (s as any).meeting_type === "online" && (
                          <Link to={`/session/${s.id}/video`}>
                            <Button size="sm" variant="outline"><Video className="h-3 w-3 mr-1" /> Join Session</Button>
                          </Link>
                        )}
                        {s.status === "completed" && !s.rating && !isTeacher && (
                          <Button size="sm" variant="outline" onClick={() => setRatingSessionId(s.id)}><Star className="h-3 w-3 mr-1" /> Rate</Button>
                        )}
                        {s.rating && <span className="text-sm flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {s.rating}/5</span>}
                        {chatRoomMap[s.id] && (s.status === "accepted" || s.status === "confirmed" || s.status === "completed") && (
                          <Link to={`/chat/${chatRoomMap[s.id]}`}>
                            <Button size="sm" variant="outline"><MessageCircle className="h-3 w-3 mr-1" /> Chat</Button>
                          </Link>
                        )}
                        <ReportUserDialog
                          reportedUserId={otherUserId}
                          reportedUserName={otherName}
                          chatRoomId={chatRoomMap[s.id]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating Modal */}
        {ratingSessionId && (
          <Card className="glass-card border-primary">
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Rate This Session</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setRatingValue(v)}>
                      <Star className={`h-8 w-8 transition-colors ${v <= ratingValue ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Review (optional)</Label>
                <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={submitRating} className="gradient-primary">Submit Rating</Button>
                <Button variant="outline" onClick={() => setRatingSessionId(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className="p-4 rounded-xl bg-secondary/50 text-center hover-lift">
                  <div className="text-2xl font-bold gradient-text mb-1">#{i + 1}</div>
                  <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center text-lg font-bold text-primary-foreground mx-auto mb-2">{entry.name.charAt(0)}</div>
                  <p className="font-medium text-sm">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.credits} credits</p>
                  {entry.avg_rating > 0 && <p className="text-xs flex items-center justify-center gap-1 mt-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {entry.avg_rating}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Session Dialog */}
        <ScheduleSessionDialog
          open={!!scheduleMatch}
          onOpenChange={(open) => !open && setScheduleMatch(null)}
          matchName={scheduleMatch?.name || ""}
          skillName={scheduleMatch?.skill_name || ""}
          onConfirm={bookSession}
        />
      </main>
    </div>
  );
};

export default Dashboard;
