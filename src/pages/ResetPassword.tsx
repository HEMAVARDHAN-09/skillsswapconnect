import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRecovery = async () => {
      // Check hash first (available synchronously)
      if (window.location.hash.includes("type=recovery")) {
        setIsRecovery(true);
        setChecking(false);
        return;
      }
      // If AuthContext already processed the hash, check for active session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsRecovery(true);
        setChecking(false);
        return;
      }
      setChecking(false);
    };

    // Listen for PASSWORD_RECOVERY event (fires if hash not yet processed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    checkRecovery();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated! Please sign in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center p-6">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center p-6">
        <Card className="w-full max-w-md glass-card border-0">
          <CardHeader className="text-center">
            <Link to="/" className="text-2xl font-bold gradient-text mb-2 inline-block">SkillSwap</Link>
            <CardTitle className="text-2xl">Invalid Link</CardTitle>
            <CardDescription>This password reset link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full gradient-primary">
              <Link to="/login">Back to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-6">
      <Card className="w-full max-w-md glass-card border-0">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-bold gradient-text mb-2 inline-block">SkillSwap</Link>
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full gradient-primary" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
