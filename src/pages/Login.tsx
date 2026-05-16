import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

const NETWORK_ERRORS = ["Failed to fetch", "NetworkError", "Network request failed", "Load failed"];

async function retryAsync(fn: () => Promise<void>, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isNetwork = NETWORK_ERRORS.some((e) => msg.includes(e));
      if (!isNetwork || attempt === maxRetries - 1) throw err;
      toast.info("Connection issue, retrying…");
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await retryAsync(() => signIn(email, password));
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setForgotLoading(false);
    }
  };

  if (showForgot) {
    return (
      <main className="min-h-screen gradient-primary flex items-center justify-center p-6">
        <SEO title="Forgot Password — SkillSwap" description="Reset your SkillSwap password using a secure email link." path="/login" />
        <h1 className="sr-only">Forgot password</h1>
        <h2 className="sr-only">Request a password reset link</h2>
        <Card className="w-full max-w-md glass-card border-0">
          <CardHeader className="text-center">
            <Link to="/" className="text-2xl font-bold gradient-text mb-2 inline-block">SkillSwap</Link>
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>
              {forgotSent ? "Check your email for a reset link." : "Enter your email and we'll send a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">A password reset link has been sent to <strong>{forgotEmail}</strong>.</p>
                <Button className="w-full gradient-primary" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}>
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required placeholder="you@example.com" />
                </div>
                <Button type="submit" className="w-full gradient-primary" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  Send Reset Link
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-primary flex items-center justify-center p-6">
      <SEO title="Login — SkillSwap" description="Sign in to your SkillSwap account to teach skills, find learners, and exchange credits." path="/login" />
      <h1 className="sr-only">Login to SkillSwap</h1>
      <h2 className="sr-only">Sign in to your account</h2>
      <Card className="w-full max-w-md glass-card border-0">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-bold gradient-text mb-2 inline-block">SkillSwap</Link>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full gradient-primary" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Sign In
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Register</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
