import { ArrowCounterClockwise, Pause, Play, SkipForward } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface PlaybackControlsProps {
  running: boolean;
  onStep: () => void;
  onRunEpisode: () => void;
  onToggleContinuous: () => void;
  onReset: () => void;
}

export function PlaybackControls({ running, onStep, onRunEpisode, onToggleContinuous, onReset }: PlaybackControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="播放控制">
      <Button variant="secondary" onClick={onStep} disabled={running}><SkipForward size={16} />单步</Button>
      <Button variant="secondary" onClick={onRunEpisode} disabled={running}><Play size={16} />运行一回合</Button>
      <Button onClick={onToggleContinuous}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停" : "连续运行"}</Button>
      <Button variant="ghost" onClick={onReset}><ArrowCounterClockwise size={16} />重置</Button>
    </div>
  );
}

