import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Radio } from "lucide-react";

export interface AudioPlayerHandle {
  seekTo: (offsetMs: number) => void;
  play: () => void;
  pause: () => void;
  currentTimeMs: number;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  {
    fullAudioUrl: string;
    totalDurationMs: number;
  }
>(function AudioPlayer({ fullAudioUrl, totalDurationMs }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [duration, setDuration] = useState(totalDurationMs || 0);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    seekTo(offsetMs: number) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = offsetMs / 1000;
        setCurrentMs(offsetMs);
        audio.play().catch(() => {});
        setPlaying(true);
      }
    },
    play() {
      audioRef.current?.play().catch(() => {});
      setPlaying(true);
    },
    pause() {
      audioRef.current?.pause();
      setPlaying(false);
    },
    get currentTimeMs() {
      return currentMs;
    },
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentMs(Math.floor(audio.currentTime * 1000));
    };
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(Math.floor(audio.duration * 1000));
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const seekRelative = (deltaMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min(duration, audio.currentTime * 1000 + deltaMs));
    audio.currentTime = newTime / 1000;
    setCurrentMs(newTime);
  };

  const progress = duration > 0 ? (currentMs / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={fullAudioUrl} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>

      {/* Progress bar + time labels */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatDuration(currentMs)}</span>
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3" />
            Full bulletin
          </span>
          <span>{formatDuration(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          value={currentMs}
          onChange={(e) => {
            const ms = Number(e.target.value);
            const audio = audioRef.current;
            if (audio) {
              audio.currentTime = ms / 1000;
              setCurrentMs(ms);
            }
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          aria-label="Audio progress"
        />
      </div>

      {/* Skip buttons */}
      <button
        onClick={() => seekRelative(-15000)}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Skip back 15 seconds"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        onClick={() => seekRelative(30000)}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Skip forward 30 seconds"
      >
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  );
});
