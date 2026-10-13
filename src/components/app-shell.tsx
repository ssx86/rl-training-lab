import type { ReactNode } from "react";
import { Flask } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { EXPERIMENTS, experimentHref, type LabId } from "@/catalog/experiment-catalog";
import { useTensorFlowStatus } from "@/hooks/use-tensorflow-status";

export function AppShell({ activeLab, children }: { activeLab: LabId | null; children: ReactNode }) {
  const tensorflow = useTensorFlowStatus();
  return <main className="min-h-[100dvh] bg-background text-foreground">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-control bg-accent text-primary"><Flask size={22} weight="fill" /></div><div><h1 className="text-lg font-semibold tracking-tight">RL 训练实验室</h1><p className="mt-0.5 text-xs text-muted-foreground">从表格价值到连续控制 · 用证据观察学习</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><Badge className="bg-accent text-[#9a5505]">四个可运行实验</Badge><Badge className="font-mono text-muted-foreground">TF.js {tensorflow.state === "ready" ? `${tensorflow.version} / ${tensorflow.backend}` : tensorflow.state === "error" ? "加载失败" : "加载中"}</Badge></div>
      </div>
      <nav aria-label="训练实验主菜单" className="border-t bg-[#fafbf9]"><div className="mx-auto flex max-w-[1680px] gap-2 overflow-x-auto px-4 py-2 sm:px-6">{EXPERIMENTS.map((experiment) => { const active = activeLab === experiment.id; return <a key={experiment.id} href={experimentHref(experiment.id)} aria-current={active ? "page" : undefined} className={`min-w-[174px] rounded-control border px-3 py-2 transition-colors ${active ? "border-primary bg-accent text-foreground" : "bg-card text-muted-foreground hover:border-[#d5b47e] hover:text-foreground"}`}><span className="block text-xs font-semibold">{experiment.name}</span><span className="mt-0.5 block font-mono text-[9px]">{experiment.algorithmLabel} · {experiment.description}</span></a>; })}</div></nav>
    </header>
    {children}
  </main>;
}
