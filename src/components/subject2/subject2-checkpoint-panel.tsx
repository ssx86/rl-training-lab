import { useEffect, useRef } from "react";
import { ArrowCounterClockwise, CheckCircle, FloppyDisk, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Subject2CheckpointInfo } from "@/hooks/use-subject2-lab";

interface Props {
  readonly info: Subject2CheckpointInfo;
  readonly promptOpen: boolean;
  readonly canSave: boolean;
  readonly error: string | null;
  readonly onSave: () => void;
  readonly onRestore: () => void;
  readonly onDismissPrompt: () => void;
}

const reasonLabel = (reason: Subject2CheckpointInfo["reason"]) => reason === "auto" ? "自动保存" : reason === "manual" ? "手动保存" : reason === "pause" ? "暂停时保存" : "已有存档";

export function Subject2CheckpointPanel({ info, promptOpen, canSave, error, onSave, onRestore, onDismissPrompt }: Props) {
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (promptOpen) restoreButtonRef.current?.focus(); }, [promptOpen]);
  const savedTime = info.savedAt ? new Date(info.savedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未保存";
  return (
    <>
      <section className="border-t pt-4" aria-label="模型存档">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-xs font-semibold"><FloppyDisk size={15} />模型存档</h3><p className="mt-1 text-[10px] leading-4 text-muted-foreground">每 1,000 步及暂停时自动保存到本浏览器</p></div>
          <span className={`font-mono text-[9px] ${info.available ? "text-success" : "text-muted-foreground"}`}>{info.available ? "● SAVED" : "○ EMPTY"}</span>
        </div>
        <div className="mt-3 border-l-2 border-primary bg-[#f8faf8] px-3 py-2 text-[10px] leading-4">
          {info.available ? <><div className="flex items-center gap-1.5 font-medium text-success"><CheckCircle size={13} />{reasonLabel(info.reason)}</div><div className="mt-1 font-mono text-muted-foreground">{info.step.toLocaleString()} 步 · {info.updates.toLocaleString()} 次更新</div><div className="text-muted-foreground">{savedTime}</div></> : <div className="text-muted-foreground">训练启动后可立即保存；首次自动存档发生在第 1,000 步。</div>}
        </div>
        {error ? <p role="alert" className="mt-2 flex gap-1.5 text-[10px] leading-4 text-danger"><WarningCircle className="mt-0.5 shrink-0" size={13} />{error}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" disabled={!canSave} onClick={onSave}><FloppyDisk size={14} />立即保存</Button><Button size="sm" variant="secondary" disabled={!info.available} onClick={onRestore}><ArrowCounterClockwise size={14} />载入存档</Button></div>
        <p className="mt-2 text-[9px] leading-4 text-muted-foreground">恢复 Actor、双 Critic、目标网络与训练计数；Replay 和优化器动量会重新积累。</p>
      </section>

      {promptOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#17201c]/72 p-4" role="dialog" aria-modal="true" aria-labelledby="subject2-restore-title">
        <Card className="w-full max-w-md shadow-[0_24px_80px_rgba(0,0,0,.28)]">
          <CardHeader><h2 id="subject2-restore-title" className="text-base font-semibold">发现本地模型存档</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">上次保存于 {savedTime}，已完成 {info.step.toLocaleString()} 个训练步和 {info.updates.toLocaleString()} 次网络更新。是否恢复？</p></CardHeader>
          <CardContent><div className="border-l-2 border-primary bg-accent px-3 py-2 text-[10px] leading-4 text-muted-foreground">恢复后保持暂停，确认画面和模型信息后再继续训练。若选择从头开始，旧存档仍保留，可稍后手动载入。</div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={onDismissPrompt}>本次从头开始</Button><Button ref={restoreButtonRef} onClick={onRestore}><ArrowCounterClockwise size={15} />使用之前的模型</Button></div></CardContent>
        </Card>
      </div> : null}
    </>
  );
}
