import { ArrowRight, Eye, Function, ListChecks } from "@phosphor-icons/react";
import { getAlgorithmLesson, type ActiveAlgorithmId } from "@/domain/algorithm-catalog";

export function AlgorithmLearningPanel({ algorithmId }: { algorithmId: ActiveAlgorithmId }) {
  const lesson = getAlgorithmLesson(algorithmId);

  return (
    <section className="border-b bg-card" aria-labelledby="algorithm-learning-title">
      <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-4 sm:px-6 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary">当前学习问题</p>
              <h2 id="algorithm-learning-title" className="mt-1 text-base font-semibold">{lesson.learningQuestion}</h2>
            </div>
            <span className="rounded-control border bg-[#f7f9f7] px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{lesson.statusLabel}</span>
          </div>

          <dl className="mt-4 grid gap-px overflow-hidden rounded-control border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {lesson.concepts.map((concept) => (
              <div key={concept.label} className="bg-card p-3">
                <dt className="text-[10px] font-medium text-muted-foreground">{concept.label}</dt>
                <dd className="mt-1 text-xs font-semibold">{concept.value}</dd>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{concept.explanation}</p>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
          <div className="rounded-control border border-[#e7ba72] bg-accent p-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold"><Function size={16} />核心公式</h3>
            <div className="mt-2 space-y-3">
              {lesson.formulas.map((formula) => (
                <div key={formula.label}>
                  <div className="text-[10px] text-[#725834]">{formula.label}</div>
                  <div className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold" data-testid="algorithm-formula">{formula.expression}</div>
                  <p className="mt-1 text-[10px] leading-4 text-[#725834]">{formula.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-control border bg-[#f7f9f7] p-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold"><Eye size={16} />按这个顺序观察</h3>
            <ol className="mt-2 space-y-2">
              {lesson.observationGuide.map((item, index) => (
                <li key={item} className="grid grid-cols-[18px_1fr] gap-2 text-[10px] leading-4 text-muted-foreground">
                  <span className="font-mono text-primary">{index + 1}</span><span>{item}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-1 border-t pt-2 font-mono text-[9px] text-muted-foreground"><ListChecks size={13} />环境<ArrowRight size={11} />策略<ArrowRight size={11} />更新<ArrowRight size={11} />证据</div>
          </div>
        </div>
      </div>
    </section>
  );
}
