import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8; // 8:00 AM to 21:30
  const min = i % 2 === 0 ? "00" : "30";
  const label = `${hour > 12 ? hour - 12 : hour}:${min} ${hour >= 12 ? "PM" : "AM"}`;
  const value = `${String(hour).padStart(2, "0")}:${min}`;
  return { label, value };
});

const DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
];

const MEETING_TYPES = [
  { label: "Online", value: "online" },
  { label: "In Person", value: "in_person" },
];

interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchName: string;
  skillName: string;
  onConfirm: (details: {
    scheduled_date: string;
    start_time: string;
    end_time: string;
    meeting_type: string;
  }) => void;
}

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  matchName,
  skillName,
  onConfirm,
}: ScheduleSessionDialogProps) {
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [meetingType, setMeetingType] = useState("online");

  const computeEndTime = (start: string, durationMin: number): string => {
    const [h, m] = start.split(":").map(Number);
    const totalMin = h * 60 + m + durationMin;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  };

  const handleConfirm = () => {
    if (!date || !startTime) return;
    const endTime = computeEndTime(startTime, duration);
    onConfirm({
      scheduled_date: format(date, "yyyy-MM-dd"),
      start_time: startTime,
      end_time: endTime,
      meeting_type: meetingType,
    });
    // Reset
    setDate(undefined);
    setStartTime("");
    setDuration(60);
    setMeetingType("online");
  };

  const isValid = !!date && !!startTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Schedule Session with {matchName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Skill: {skillName}</p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" /> Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time slot */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Start Time
            </Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select a time" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meeting type */}
          <div className="space-y-2">
            <Label>Meeting Type</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {isValid && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
              <p className="font-medium">Session Summary</p>
              <p>📅 {format(date!, "PPP")}</p>
              <p>🕐 {TIME_SLOTS.find((t) => t.value === startTime)?.label} — {computeEndTime(startTime, duration)}</p>
              <p>📍 {meetingType === "online" ? "Online" : "In Person"}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="gradient-primary"
          >
            Book Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
