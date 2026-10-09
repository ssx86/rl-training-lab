import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { LabParameters } from "@/hooks/use-lab";

interface ParameterPanelProps {
  parameters: LabParameters;
  disabled: boolean;
  onChange: <K extends keyof LabParameters>(key: K, value: LabParameters[K]) => void;
}

export function ParameterPanel({ parameters, disabled, onChange }: ParameterPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">训练参数</h2>
      </CardHeader>
      <CardContent className="space-y-5">
        <RangeField label="学习率 alpha" value={parameters.alpha} min={0} max={1} step={0.01} disabled={disabled} onChange={(value) => onChange("alpha", value)} />
        <RangeField label="折扣率 gamma" value={parameters.gamma} min={0} max={1} step={0.01} disabled={disabled} onChange={(value) => onChange("gamma", value)} />
        <RangeField label="探索率 epsilon" value={parameters.epsilon} min={0} max={1} step={0.01} disabled={disabled} onChange={(value) => onChange("epsilon", value)} />
        <NumberField label="epsilon 最小值" value={parameters.epsilonMin} step={0.01} disabled={disabled} onChange={(value) => onChange("epsilonMin", value)} />
        <NumberField label="epsilon 衰减" value={parameters.epsilonDecay} step={0.001} disabled={disabled} onChange={(value) => onChange("epsilonDecay", value)} />
        <NumberField label="目标回合数" value={parameters.targetEpisodes} step={10} disabled={disabled} onChange={(value) => onChange("targetEpisodes", Math.max(1, value))} />
        <NumberField label="每回合最大步数" value={parameters.maxSteps} step={10} disabled={disabled} onChange={(value) => onChange("maxSteps", Math.max(1, value))} />
        <label className="block space-y-2 text-xs text-muted-foreground">
          <span className="flex items-center justify-between"><span>播放间隔</span><output className="font-mono text-foreground">{parameters.speedMs} ms</output></span>
          <Slider aria-label="播放间隔" min={16} max={1000} step={16} value={[parameters.speedMs]} disabled={disabled} onValueChange={([value]) => onChange("speedMs", value)} />
        </label>
      </CardContent>
    </Card>
  );
}

function RangeField({ label, value, min, max, step, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span className="flex items-center justify-between"><span>{label}</span><output className="font-mono text-foreground">{value.toFixed(3)}</output></span>
      <Slider aria-label={label} min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([next]) => onChange(next)} />
    </label>
  );
}

function NumberField({ label, value, step, disabled, onChange }: { label: string; value: number; step: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[1fr_88px] items-center gap-3 text-xs text-muted-foreground">
      <span>{label}</span>
      <input className="h-8 rounded-control border bg-card px-2 font-mono text-foreground" type="number" step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

