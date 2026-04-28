import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Send, Shield, Loader2, Ban } from "lucide-react";
import ReportUserDialog from "@/components/ReportUserDialog";

type Message = {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

const ChatRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<{ user_id: string; name: string } | null>(null);
  const [skillName, setSkillName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !roomId) { navigate("/dashboard"); return; }
    loadRoom();
  }, [user, roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`chat-${roomId}`, { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadRoom = async () => {
    setLoading(true);
    // Load chat room
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", roomId!)
      .single();

    if (!room) { toast.error("Chat room not found"); navigate("/dashboard"); return; }

    // Load the other user
    const otherId = room.user1_id === user!.id ? room.user2_id : room.user1_id;
    const { data: profile } = await supabase
      .rpc("get_public_profiles" as any, { _user_ids: [otherId] } as any);
    setOtherUser((profile as any)?.[0] || null);

    // Get session skill name
    const { data: session } = await supabase
      .from("sessions")
      .select("skill_name")
      .eq("id", room.session_id)
      .single();
    setSkillName(session?.skill_name || "");

    // Check if blocked
    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", user!.id)
      .eq("blocked_id", otherId);
    setIsBlocked((blocked?.length ?? 0) > 0);

    // Load messages
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_room_id", roomId!)
      .order("created_at", { ascending: true });
    setMessages(msgs || []);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !roomId || !user || isBlocked) return;
    const { error } = await supabase.from("chat_messages").insert({
      chat_room_id: roomId,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) { toast.error("Failed to send message"); return; }
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleBlock = async () => {
    if (!otherUser) return;
    if (isBlocked) {
      await supabase.from("blocked_users").delete().eq("blocker_id", user!.id).eq("blocked_id", otherUser.user_id);
      setIsBlocked(false);
      toast.success("User unblocked");
    } else {
      await supabase.from("blocked_users").insert({ blocker_id: user!.id, blocked_id: otherUser.user_id });
      setIsBlocked(true);
      toast.success("User blocked");
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((m) => {
    const date = formatDate(m.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(m);
    } else {
      groupedMessages.push({ date, msgs: [m] });
    }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground">
                {otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-semibold">{otherUser?.name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{skillName} Session</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleBlock} title={isBlocked ? "Unblock" : "Block"}>
              <Ban className={`h-4 w-4 ${isBlocked ? "text-destructive" : ""}`} />
            </Button>
            {otherUser && (
              <ReportUserDialog
                reportedUserId={otherUser.user_id}
                reportedUserName={otherUser.name}
                chatRoomId={roomId}
                trigger={
                  <Button variant="ghost" size="icon" title="Report User">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container mx-auto max-w-2xl space-y-6">
          {/* Security Notice */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-4 py-2 rounded-full">
              <Shield className="h-3 w-3" />
              Messages are private between you and {otherUser?.name}. Never share personal contact info.
            </div>
          </div>

          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center mb-4">
                <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">{group.date}</span>
              </div>
              <div className="space-y-2">
                {group.msgs.map((m) => {
                  const isMine = m.sender_id === user!.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                        isMine
                          ? "gradient-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-secondary-foreground rounded-bl-md"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="glass-card border-t sticky bottom-0">
        <div className="container mx-auto max-w-2xl px-4 py-3">
          {isBlocked ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              You have blocked this user. <Button variant="link" className="p-0 h-auto" onClick={toggleBlock}>Unblock</Button> to send messages.
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 rounded-full bg-secondary/50 border-0"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="gradient-primary rounded-full"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
