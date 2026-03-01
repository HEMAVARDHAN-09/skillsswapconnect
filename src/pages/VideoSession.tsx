import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PhoneOff, Clock, ArrowLeft, VideoOff, AlertTriangle, Circle, Square, Monitor } from "lucide-react";
import { useScreenRecording } from "@/hooks/useScreenRecording";

const VideoSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const { isRecording, startRecording, stopRecording } = useScreenRecording();

  // Fetch session and check authorization
  useEffect(() => {
    if (!user || !sessionId) {
      navigate("/login");
      return;
    }

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error || !data) {
        toast.error("Session not found");
        navigate("/dashboard");
        return;
      }

      if (data.teacher_id !== user.id && data.learner_id !== user.id) {
        toast.error("You are not authorized to join this session");
        navigate("/dashboard");
        return;
      }

      if (data.meeting_type !== "online") {
        toast.error("This is not an in-app session");
        navigate("/dashboard");
        return;
      }

      setSession(data);
      setAuthorized(true);
      setLoading(false);
    };

    fetchSession();
  }, [user, sessionId, navigate]);

  // Start session: log start_time
  const handleStart = async () => {
    // Check camera/microphone permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMediaError(null);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMediaError("Camera and microphone access was denied. Please allow permissions in your browser settings and try again.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setMediaError("No camera or microphone found. Please connect a device and try again.");
      } else {
        setMediaError("Could not access camera/microphone. You can still join, but video may not work.");
      }
    }

    const now = new Date();
    startTimeRef.current = now;
    setStarted(true);

    const timeStr = now.toTimeString().slice(0, 8);
    await supabase
      .from("sessions")
      .update({ start_time: timeStr })
      .eq("id", sessionId);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    toast.success("Session started!");
  };

  // End session: log end_time
  const handleEnd = async () => {
    if (isRecording) stopRecording();
    if (timerRef.current) clearInterval(timerRef.current);

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    await supabase
      .from("sessions")
      .update({ end_time: timeStr })
      .eq("id", sessionId);

    toast.success("Session ended");
    navigate("/dashboard");
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Jitsi room name is deterministic based on session ID
  const jitsiRoom = `skillswap-${sessionId}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{session.skill_name}</h1>
            <p className="text-xs text-muted-foreground">Video Session</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{formatTime(elapsed)}</span>
          </div>

          {/* Recording + Start / End buttons */}
          {started && (
            isRecording ? (
              <Button variant="outline" onClick={stopRecording} className="border-destructive text-destructive hover:bg-destructive/10">
                <Square className="h-3 w-3 mr-2 fill-destructive" />
                Stop Recording
              </Button>
            ) : (
              <Button variant="outline" onClick={startRecording}>
                <Circle className="h-3 w-3 mr-2 fill-destructive text-destructive" />
                Record
              </Button>
            )
          )}

          {!started ? (
            <Button onClick={handleStart} className="gradient-primary">
              Start Session
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleEnd}>
              <PhoneOff className="h-4 w-4 mr-2" />
              End Session
            </Button>
          )}
        </div>
      </header>

      {/* Jitsi iframe */}
      <div className="flex-1 relative">
        {started ? (
          <>
            {mediaError && (
              <div className="absolute top-0 left-0 right-0 z-10 bg-destructive/10 border-b border-destructive/30 px-4 py-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive font-medium">{mediaError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto shrink-0"
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                      stream.getTracks().forEach((t) => t.stop());
                      setMediaError(null);
                      toast.success("Permissions granted! Reload the video panel if needed.");
                    } catch {
                      toast.error("Still unable to access camera/microphone.");
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
            <iframe
              src={`https://meet.jit.si/${jitsiRoom}#config.prejoinConfig.enabled=false&userInfo.displayName=${encodeURIComponent(user?.user_metadata?.name || "User")}`}
              className="w-full h-full absolute inset-0 border-0"
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
              title="Video Session"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full absolute inset-0">
            <Card className="p-8 text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">Ready to join?</h2>
              <p className="text-muted-foreground mb-4">
                Click "Start Session" to begin the video call and start the timer.
                The session will be recorded in your history.
              </p>
              <p className="text-sm text-muted-foreground">
                Skill: <span className="font-medium text-foreground">{session.skill_name}</span>
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSession;
