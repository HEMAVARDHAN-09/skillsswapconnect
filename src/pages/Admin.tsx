import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, Users, BookOpen, Calendar, Trash2, BarChart3, Loader2,
  Flag, CheckCircle, Search, Shield, AlertTriangle, UserX, MessageSquare,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [reportProfiles, setReportProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [newReportAlert, setNewReportAlert] = useState<{ reporter: string; reported: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { navigate("/dashboard"); return; }
    loadAll();
  }, [user, isAdmin, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, { data: sk }, { data: se }, { data: rp }, { data: cr }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("skills").select("*"),
      supabase.from("sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      supabase.from("chat_rooms").select("*"),
    ]);
    setUsers(u || []);
    setSkills(sk || []);
    setSessions(se || []);
    setReports(rp || []);
    setChatRooms(cr || []);
    if (rp?.length) {
      const ids = [...new Set(rp.flatMap((r: any) => [r.reporter_id, r.reported_id]))];
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", ids);
      const map: Record<string, string> = {};
      profs?.forEach((p) => { map[p.user_id] = p.name; });
      setReportProfiles(map);
    }
    setLoading(false);
  };

  const deleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User account deleted successfully");
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
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

  const updateSessionStatus = async (id: string, status: string) => {
    await supabase.from("sessions").update({ status }).eq("id", id);
    toast.success(`Session ${status}`);
    loadAll();
  };

  const updateReportStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    toast.success(`Report ${status}`);
    loadAll();
  };

  // Analytics
  const popularSkill = skills.length
    ? Object.entries(
        skills.reduce((acc: Record<string, number>, s) => { acc[s.skill_name] = (acc[s.skill_name] || 0) + 1; return acc; }, {})
      ).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "N/A"
    : "N/A";

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const activeSessionsCount = sessions.filter((s) => s.status === "accepted" || s.status === "confirmed").length;

  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserName = (userId: string) => users.find((u) => u.user_id === userId)?.name || "Unknown";

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold gradient-text">SkillSwap Admin</span>
          </div>
          <Link to="/dashboard"><Button variant="ghost"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users, label: "Users", value: users.length, color: "text-blue-500" },
            { icon: BookOpen, label: "Skills", value: skills.length, color: "text-green-500" },
            { icon: Calendar, label: "Sessions", value: sessions.length, color: "text-purple-500" },
            { icon: Calendar, label: "Active", value: activeSessionsCount, color: "text-emerald-500" },
            { icon: Flag, label: "Reports", value: pendingReports, color: "text-destructive" },
            { icon: MessageSquare, label: "Chat Rooms", value: chatRooms.length, color: "text-orange-500" },
          ].map((s, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="pt-4 pb-3 text-center">
                <s.icon className={`h-6 w-6 mx-auto mb-1 ${s.color}`} />
                <div className="text-xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="reports">
              Reports {pendingReports > 0 && <span className="ml-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">{pendingReports}</span>}
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User Management</CardTitle>
                <CardDescription>Search, view, and manage all user accounts</CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const userSkills = skills.filter((s) => s.user_id === u.user_id).length;
                      const userSessions = sessions.filter((s) => s.teacher_id === u.user_id || s.learner_id === u.user_id).length;
                      const isCurrentUser = u.user_id === user?.id;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>{u.credits}</TableCell>
                          <TableCell>{userSkills}</TableCell>
                          <TableCell>{userSessions}</TableCell>
                          <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {isCurrentUser ? (
                              <span className="text-xs text-muted-foreground">You</span>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" disabled={deletingUserId === u.user_id}>
                                    {deletingUserId === u.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3 mr-1" />}
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-destructive" /> Delete User Account
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete <strong>{u.name}</strong>'s account and all their data including skills, sessions, chat messages, and reports. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteUser(u.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Delete Account
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No users found.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SKILLS TAB */}
          <TabsContent value="skills">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> All Skills</CardTitle>
                <CardDescription>Manage all skills registered on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Skill</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skills.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.skill_name}</TableCell>
                        <TableCell className="text-muted-foreground">{getUserName(s.user_id)}</TableCell>
                        <TableCell>{s.level}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.type === "Teach" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"}`}>
                            {s.type}
                          </span>
                        </TableCell>
                        <TableCell>{s.mode}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => deleteSkill(s.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SESSIONS TAB */}
          <TabsContent value="sessions">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> All Sessions</CardTitle>
                <CardDescription>View and manage all sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Skill</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Learner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.skill_name}</TableCell>
                        <TableCell>{getUserName(s.teacher_id)}</TableCell>
                        <TableCell>{getUserName(s.learner_id)}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            s.status === "completed" ? "bg-green-100 text-green-800" :
                            s.status === "accepted" || s.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                            s.status === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {s.status}
                          </span>
                        </TableCell>
                        <TableCell>{s.rating ? `${s.rating}/5` : "—"}</TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="flex gap-1">
                          {s.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "rejected")}>
                              Cancel
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => deleteSession(s.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTS TAB */}
          <TabsContent value="reports">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> User Reports</CardTitle>
                <CardDescription>Review and manage reports from users</CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No reports yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Reported User</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{reportProfiles[r.reporter_id] || "Unknown"}</TableCell>
                          <TableCell className="font-medium">{reportProfiles[r.reported_id] || "Unknown"}</TableCell>
                          <TableCell className="max-w-[250px]">
                            <p className="truncate" title={r.reason}>{r.reason}</p>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              r.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                              r.status === "reviewed" ? "bg-green-100 text-green-800" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="flex gap-1">
                            {r.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateReportStatus(r.id, "reviewed")}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Review
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateReportStatus(r.id, "dismissed")}>
                                  Dismiss
                                </Button>
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
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Most Popular Skill</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold gradient-text">{popularSkill}</div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Avg Credits per User</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {users.length ? (users.reduce((a, u) => a + u.credits, 0) / users.length).toFixed(1) : 0}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Completion Rate</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {sessions.length ? `${Math.round((sessions.filter((s) => s.status === "completed").length / sessions.length) * 100)}%` : "0%"}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Avg Session Rating</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => { const rated = sessions.filter((s) => s.rating); return rated.length ? (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1) + "/5" : "N/A"; })()}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Teach vs Learn Skills</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>Teaching: <strong>{skills.filter((s) => s.type === "Teach").length}</strong></p>
                    <p>Learning: <strong>{skills.filter((s) => s.type === "Learn").length}</strong></p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Online vs Offline</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>Online: <strong>{skills.filter((s) => s.mode === "Online").length}</strong></p>
                    <p>Offline: <strong>{skills.filter((s) => s.mode === "Offline").length}</strong></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
