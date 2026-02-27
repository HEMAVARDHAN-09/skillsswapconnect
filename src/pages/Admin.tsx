import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Users, BookOpen, Calendar, Trash2, BarChart3, Loader2 } from "lucide-react";

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { navigate("/dashboard"); return; }
    loadAll();
  }, [user, isAdmin, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, { data: sk }, { data: se }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("skills").select("*"),
      supabase.from("sessions").select("*"),
    ]);
    setUsers(u || []);
    setSkills(sk || []);
    setSessions(se || []);
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
      </div>
    </div>
  );
};

export default Admin;
