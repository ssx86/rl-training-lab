import { useState } from "react";
import { ArrowSquareOut, CheckCircle, Eye, Function, ListChecks, XCircle } from "@phosphor-icons/react";
import { getExperiment, LEARNING_LOOP, type LabId } from "@/catalog/experiment-catalog";
import { Button } from "@/components/ui/button";

export function CompanionLearningPanel({ labId }: { readonly labId: LabId }) {
  const experiment = getExperiment(labId);
  const [prediction, setPrediction] = useState<string | null>(null);
  const predictionCorrect = prediction === experiment.prediction.answer;

  return (
    <section className="border-b bg-card" aria-labelledby="companion-learning-title">
      <div className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[880px]">
            <p className="text-xs font-medium text-primary">RL Field Guide 配套实验</p>
            <h2 id="companion-learning-title" className="mt-1 text-base font-semibold">{experiment.learningQuestion}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{experiment.guide.reason}</p>
          </div>
          <a href={experiment.guide.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[390px] items-start gap-2 rounded-control border bg-[#f7f9f7] px-3 py-2 text-xs text-muted-foreground hover:border-[#d5b47e] hover:text-foreground">
            <span><span className="block text-[9px] uppercase tracking-[.12em]">English chapter · {experiment.guide.slug}</span><strong className="mt-1 block font-medium leading-4">{experiment.guide.title}</strong></span>
            <ArrowSquareOut className="mt-0.5 shrink-0" size={15} />
          </a>
        </div>

        <ol className="mt-4 grid gap-px overflow-hidden rounded-control border bg-border sm:grid-cols-5" aria-label="证据优先学习循环">
          {LEARNING_LOOP.map((stage, index) => (
            <li key={stage.id} className="grid grid-cols-[22px_1fr] gap-2 bg-card p-2.5">
              <span className="font-mono text-[10px] text-primary">0{index + 1}</span>
              <span><strong className="block text-[11px]">{stage.label}</strong><span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">{stage.note}</span></span>
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-control border border-[#e7ba72] bg-accent p-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold"><ListChecks size={16} />先预测</h3>
            <p className="mt-2 text-xs leading-5">{experiment.prediction.prompt}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {experiment.prediction.choices.map((choice) => (
                <Button key={choice} type="button" variant="secondary" className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left text-xs leading-4" aria-pressed={prediction === choice} onClick={() => setPrediction(choice)}>{choice}</Button>
              ))}
            </div>
            {prediction ? <div className={`mt-3 flex items-start gap-2 border-t pt-3 text-xs leading-5 ${predictionCorrect ? "text-success" : "text-danger"}`} aria-live="polite">
              {predictionCorrect ? <CheckCircle className="mt-0.5 shrink-0" size={17} weight="fill" /> : <XCircle className="mt-0.5 shrink-0" size={17} weight="fill" />}
              <span><strong>{predictionCorrect ? "判断正确" : "这个判断需要修正"}</strong><span className="mt-0.5 block text-foreground">{experiment.prediction.explanation}</span></span>
            </div> : <p className="mt-3 border-t pt-2 text-[10px] text-[#725834]">先选择判断，机制与公式才会展开；实验本身始终可以操作。</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control border bg-[#f7f9f7] p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold"><Eye size={16} />运行与数值证据</h3>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{experiment.runInstruction}</p>
              <ul className="mt-2 space-y-1.5">
                {experiment.evidenceSignals.map((signal) => <li key={signal} className="grid grid-cols-[12px_1fr] gap-2 text-[10px] leading-4"><span className="font-mono text-primary">·</span><span>{signal}</span></li>)}
              </ul>
            </div>
            <div className="rounded-control border bg-[#f7f9f7] p-3">
              <h3 className="text-xs font-semibold">迁移与边界</h3>
              <p className="mt-2 text-[10px] font-medium leading-4">{experiment.transfer.prompt}</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{experiment.transfer.note}</p>
              <p className="mt-2 border-t pt-2 text-[10px] leading-4 text-danger">边界：{experiment.boundary}</p>
            </div>
          </div>
        </div>

        {prediction ? <div className="mt-4 grid gap-3 rounded-control border bg-[#f7f9f7] p-3 md:grid-cols-[220px_1fr]">
          <div><h3 className="flex items-center gap-2 text-xs font-semibold"><Function size={16} />证据之后再读公式</h3><p className="mt-2 text-[10px] leading-4 text-muted-foreground">公式不是新的故事；每个符号都应能回指上方实验中的真实数值。</p></div>
          <div className="grid gap-3 lg:grid-cols-2">{experiment.formulas.map((formula) => <div key={formula.label} className="border-l-2 border-primary pl-3"><div className="text-[10px] text-muted-foreground">{formula.label}</div><div className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold" data-testid="algorithm-formula">{formula.expression}</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{formula.explanation}</p></div>)}</div>
        </div> : null}
      </div>
    </section>
  );
}
