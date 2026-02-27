import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Users, BookOpen, Calendar, Trash2, BarChart3, Loader2, Flag, CheckCircle } from "lucide-react";

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportProfiles, setReportProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { navigate("/dashboard"); return; }
    loadAll();
  }, [user, isAdmin, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, { data: sk }, { data: se }, { data: rp }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("skills").select("*"),
      supabase.from("sessions").select("*"),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers(u || []);
    setSkills(sk || []);
    setSessions(se || []);
    setReports(rp || []);
    // Load reporter/reported names
    if (rp?.length) {
      const ids = [...new Set(rp.flatMap((r: any) => [r.reporter_id, r.reported_id]))];
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", ids);
      const map: Record<string, string> = {};
      profs?.forEach((p) => { map[p.user_id] = p.name; });
      setReportProfiles(map);
    }
    setLoading(false);
  };

  const deleteSkill = async (id: string) => {
    await supabase.from("skills").delete().eq("id", id);
    toast.success("Skill deleted");
    loadAll();
  };

  const deleteSession = async (id: string) => {
    await supabase.from("sessions").delete().eq("id", id);
    toast.success("Session deleted");
    loadAll();
  };

  const updateReportStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    toast.success(`Report ${status}`);
    loadAll();
  };

  // Analytics
  const popularSkill = skills.length ? Object.entries(
    skills.reduce((acc: Record<string, number>, s) => { acc[s.skill_name] = (acc[s.skill_name] || 0) + 1; return acc; }, {})
  ).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "N/A" : "N/A";

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold gradient-text">SkillSwap Admin</Link>
          <Link to="/dashboard"><Button variant="ghost"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Analytics */}
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Total Users", value: users.length, color: "text-blue-500" },
            { icon: BookOpen, label: "Total Skills", value: skills.length, color: "text-green-500" },
            { icon: Calendar, label: "Total Sessions", value: sessions.length, color: "text-purple-500" },
            { icon: BarChart3, label: "Popular Skill", value: popularSkill, color: "text-orange-500" },
          ].map((s, i) => (
            <Card key={i} className="glass-card hover-lift">
              <CardContent className="pt-6 text-center">
                <s.icon className={`h-8 w-8 mx-auto mb-2 ${s.color}`} />
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="glass-card">
          <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Credits</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}><TableCell>{u.name}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.credits}</TableCell><TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Skills Table */}
        <Card className="glass-card">
          <CardHeader><CardTitle>All Skills</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Level</TableHead><TableHead>Type</TableHead><TableHead>Mode</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {skills.map((s) => (
                  <TableRow key={s.id}><TableCell>{s.skill_name}</TableCell><TableCell>{s.level}</TableCell><TableCell>{s.type}</TableCell><TableCell>{s.mode}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => deleteSkill(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sessions Table */}
        <Card className="glass-card">
          <CardHeader><CardTitle>All Sessions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Status</TableHead><TableHead>Rating</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}><TableCell>{s.skill_name}</TableCell><TableCell>{s.status}</TableCell><TableCell>{s.rating ?? "—"}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => deleteSession(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> User Reports</CardTitle></CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reports yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Reporter</TableHead><TableHead>Reported</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{reportProfiles[r.reporter_id] || "Unknown"}</TableCell>
                      <TableCell>{reportProfiles[r.reported_id] || "Unknown"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                      <TableCell><span className={`text-xs font-medium px-2 py-1 rounded-full ${r.status === "pending" ? "bg-yellow-100 text-yellow-800" : r.status === "reviewed" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>{r.status}</span></TableCell>
                      <TableCell className="flex gap-1">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateReportStatus(r.id, "reviewed")}><CheckCircle className="h-3 w-3 mr-1" /> Review</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateReportStatus(r.id, "dismissed")}>Dismiss</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
