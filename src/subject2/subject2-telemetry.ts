export interface Subject2ControlSample {
  readonly throttle: number;
  readonly brake: number;
  readonly stopped: boolean;
}

export interface Subject2ControlSummary {
  readonly throttlePercent: number;
  readonly brakePercent: number;
  readonly stationaryPercent: number;
}

export function summarizeSubject2Controls(samples: readonly Subject2ControlSample[]): Subject2ControlSummary {
  if (samples.length === 0) return { throttlePercent: 0, brakePercent: 0, stationaryPercent: 0 };
  const percent = (count: number) => Math.round(count / samples.length * 100);
  return {
    throttlePercent: percent(samples.filter((sample) => sample.throttle > .05).length),
    brakePercent: percent(samples.filter((sample) => sample.brake > .05).length),
    stationaryPercent: percent(samples.filter((sample) => sample.stopped).length),
  };
}
