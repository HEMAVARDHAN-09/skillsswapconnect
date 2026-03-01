import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

export const useScreenRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      // Try to capture microphone audio and mix it
      let combinedStream = screenStream;
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();

        // Mix screen audio (if any) + mic audio
        screenStream.getAudioTracks().forEach((track) => {
          audioCtx.createMediaStreamSource(new MediaStream([track])).connect(dest);
        });
        micStream.getAudioTracks().forEach((track) => {
          audioCtx.createMediaStreamSource(new MediaStream([track])).connect(dest);
        });

        combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        // Stop mic when screen stops
        screenStream.getVideoTracks()[0].addEventListener("ended", () => {
          micStream.getTracks().forEach((t) => t.stop());
        });
      } catch {
        // Mic unavailable — record screen only
      }

      streamRef.current = combinedStream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session-recording-${new Date().toISOString().slice(0, 19)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Recording saved!");
      };

      recorder.start(1000); // collect chunks every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success("Recording started");

      // Auto-stop if user stops sharing
      screenStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopRecording();
      });
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Screen sharing permission denied");
      } else {
        toast.error("Could not start recording");
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording };
};
