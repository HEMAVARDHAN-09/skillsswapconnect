import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Flag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const REPORT_REASONS = [
  "Inappropriate behaviour",
  "Harassment or bullying",
  "Spam or scam",
  "Fake profile",
  "Offensive content",
  "Other",
];

interface ReportUserDialogProps {
  reportedUserId: string;
  reportedUserName: string;
  chatRoomId?: string;
  trigger?: React.ReactNode;
}

const ReportUserDialog = ({
  reportedUserId,
  reportedUserName,
  chatRoomId,
  trigger,
}: ReportUserDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) { toast.error("Please select a reason"); return; }
    if (!user) return;

    setSubmitting(true);
    const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: reportedUserId,
      reason: fullReason,
      chat_room_id: chatRoomId || null,
    });

    if (error) {
      toast.error("Failed to submit report");
    } else {
      toast.success("Report submitted. Our admin team will review it shortly.");
      setOpen(false);
      setReason("");
      setDetails("");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Flag className="h-3.5 w-3.5 mr-1" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report {reportedUserName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason" aria-label="Report reason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Additional details <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the issue in more detail..."
              className="min-h-[90px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
            Reports are anonymous and reviewed by our admin team. False reports may result in action against your account.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportUserDialog;
