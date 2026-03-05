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
    const handleRecovery = async () => {
      // PKCE flow: Supabase redirects with ?code=... query param
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setIsRecovery(true);
        } catch (err: any) {
          toast.error("Reset link is invalid or has expired. Please request a new one.");
          setIsRecovery(false);
        }
        setChecking(false);
        return;
      }

      // Legacy implicit flow: check hash fragment
      if (window.location.hash.includes("type=recovery")) {
        setIsRecovery(true);
        setChecking(false);
        return;
      }

      // Check sessionStorage flag set by AuthContext PASSWORD_RECOVERY event
      if (sessionStorage.getItem("supabase_recovery") === "true") {
        sessionStorage.removeItem("supabase_recovery");
        setIsRecovery(true);
        setChecking(false);
        return;
      }

      setChecking(false);
    };

    // Also listen for PASSWORD_RECOVERY event (legacy implicit flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.removeItem("supabase_recovery");
        setIsRecovery(true);
        setChecking(false);
      }
    });

    handleRecovery();
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
      await supabase.auth.signOut();
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
          <CardContent className="space-y-3">
            <Button asChild className="w-full gradient-primary">
              <Link to="/login">Back to Login</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Need a new link?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Request password reset
              </Link>
            </p>
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
