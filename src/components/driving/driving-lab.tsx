import { Brain, CarProfile, Eye, Gauge, Lightning, Pause, Play, RoadHorizon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FLEET_CITY_MAPS } from "@/driving/city-map";
import { RADAR_CHANNELS, type RadarChannel } from "@/driving/continuous-control";
import { RADAR_MAX_DISTANCE } from "@/driving/radar";
import type { FleetMode } from "@/driving/shared-fleet-runtime";
import type { PlaybackRate, TrainingSpeed } from "@/workers/fleet-trainer-protocol";
import { useSharedFleet } from "@/hooks/use-shared-fleet";
import { DriverView3D } from "./driver-view-3d";
import { FleetCityCanvas } from "./fleet-city-canvas";

const RADAR_LABEL: Record<RadarChannel, string> = {
  "road-edge": "道路边缘", vehicle: "车辆", structure: "建筑 / 路障", destination: "目的地",
};

const RADAR_COLOR: Record<RadarChannel, string> = {
  "road-edge": "#d97706", vehicle: "#b42318", structure: "#174f43", destination: "#216096",
};

export function DrivingLab() {
  const lab = useSharedFleet();
  const city = lab.snapshot?.city ?? FLEET_CITY_MAPS.find((item) => item.id === lab.cityId) ?? FLEET_CITY_MAPS[0];
  const selected = lab.snapshot?.vehicles[lab.selectedVehicle];
  const learner = lab.snapshot?.vehicles[lab.snapshot.learnerIndex];
  const running = lab.status === "running";

  return (
    <div className="mx-auto max-w-[1680px] p-3 sm:p-5">
      <section className="mb-4 grid gap-3 border-b pb-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <Tabs value={lab.mode} onValueChange={(value) => lab.setMode(value as FleetMode)}>
          <TabsList><TabsTrigger value="training"><Brain size={15} />训练</TabsTrigger><TabsTrigger value="inference"><Eye size={15} />推理评估</TabsTrigger></TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground lg:text-center">
          {lab.mode === "training" ? "一个 learner 用连续控制写入共享 Replay，其余车辆实时使用最新 TD3 actor" : "冻结 actor、双 critic 与 Replay，以驾驶员视角观察共享策略"}
        </p>
        <div className="flex items-center justify-end gap-3 font-mono text-xs">
          <span className={running ? "text-success" : "text-muted-foreground"}>{running ? "● RUNNING" : "○ PAUSED"}</span>
          <span>step {lab.snapshot?.step.toLocaleString() ?? 0}</span>
        </div>
      </section>

      {lab.error ? <div role="alert" className="mb-4 border-l-4 border-danger bg-[#fff4f2] px-4 py-3 text-sm text-danger">{lab.error}</div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden shadow-[0_18px_50px_rgba(22,42,35,.12)]">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b">
              <div><h2 className="flex items-center gap-2 text-sm font-semibold"><RoadHorizon size={18} />{city.name}</h2><p className="mt-1 text-xs text-muted-foreground">真实米制路网 · {RADAR_MAX_DISTANCE}m 前向雷达 · 21 扇区 × 4 距离通道</p></div>
              <div className="text-right font-mono text-[10px] text-muted-foreground"><div>TD3 · {lab.snapshot?.vehicles.length ?? lab.vehicleCount} actors</div><div className="mt-1">{lab.runtimeMetrics.backend} · {Math.round(lab.runtimeMetrics.stepsPerSecond).toLocaleString()} step/s</div></div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              <FleetCityCanvas city={city} snapshot={lab.snapshot} selectedVehicle={lab.selectedVehicle} />
              {city.attribution ? <a className="mt-1 block text-right text-[9px] text-muted-foreground underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{city.attribution}</a> : null}
            </CardContent>
          </Card>

          <section className="grid gap-px overflow-hidden rounded-panel border bg-border sm:grid-cols-7">
            {[
              ["LEARNER", learner?.label ?? "等待启动"],
              ["NOISE", lab.snapshot?.explorationNoise.toFixed(3) ?? "—"],
              ["REPLAY", lab.snapshot?.replaySize.toLocaleString() ?? "0"],
              ["UPDATES", lab.snapshot?.updates.toLocaleString() ?? "0"],
              ["CRITIC", lab.snapshot?.criticLoss?.toFixed(4) ?? "—"],
              ["ACTOR", lab.snapshot?.actorLoss?.toFixed(4) ?? "—"],
              ["ACCIDENTS", lab.snapshot?.accidents.length ?? 0],
            ].map(([label, value]) => <div key={label} className="bg-card px-4 py-3"><div className="font-mono text-[9px] text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div></div>)}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
            <Card>
              <CardHeader><h2 className="text-sm font-semibold">多通道雷达与连续控制</h2><p className="mt-1 text-xs text-muted-foreground">同一角度同时保存道路、车辆、结构和目的地距离，不再互相覆盖</p></CardHeader>
              <CardContent>
                {selected ? <>
                  <div className="space-y-2">
                    {RADAR_CHANNELS.map((channel) => <div key={channel} className="grid grid-cols-[88px_1fr] items-center gap-2"><span className="truncate text-[10px] font-medium" style={{ color: RADAR_COLOR[channel] }}>{RADAR_LABEL[channel]}</span><div className="grid h-5 gap-px" style={{ gridTemplateColumns: `repeat(${selected.radar.beams.length}, minmax(0, 1fr))` }}>{selected.radar.beams.map((beam, index) => <span key={index} title={`${Math.round(beam.angle * 180 / Math.PI)}° · ${(beam.distances[channel] * RADAR_MAX_DISTANCE).toFixed(1)}m`} className="rounded-[1px]" style={{ backgroundColor: RADAR_COLOR[channel], opacity: .12 + (1 - beam.distances[channel]) * .88 }} />)}</div></div>)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="border-l-2 border-primary bg-accent px-3 py-2"><div className="text-[9px] text-muted-foreground">方向盘</div><div className="font-mono text-sm font-semibold">{selected.action.steer >= 0 ? "右" : "左"} {Math.round(Math.abs(selected.action.steer) * 100)}%</div></div>
                    <div className="border-l-2 border-primary bg-accent px-3 py-2"><div className="text-[9px] text-muted-foreground">踏板</div><div className="font-mono text-sm font-semibold">{selected.action.throttle >= 0 ? "油门" : "制动"} {Math.round(Math.abs(selected.action.throttle) * 100)}%</div></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{selected.radar.detections.slice(0, 8).map((detection) => <span key={`${detection.channel}-${detection.id}`} className="rounded-full border bg-card px-2 py-1 text-[9px]"><span style={{ color: RADAR_COLOR[detection.channel] }}>●</span> {detection.label} {detection.distanceMeters.toFixed(1)}m</span>)}</div>
                </> : <p className="py-8 text-center text-xs text-muted-foreground">启动训练后显示 21×4 雷达距离和连续方向盘 / 踏板输出。</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h2 className="text-sm font-semibold">观察说明</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">总览图可无损缩放至单车尺度。21 条细线组成 180° 雷达扇区，颜色表示当前最近通道，长度严格对应 {RADAR_MAX_DISTANCE} 米。</p></CardHeader>
            </Card>
          </div>

          <Card className={lab.mode === "inference" ? "ring-2 ring-primary/30" : ""}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div><h2 className="flex items-center gap-2 text-sm font-semibold"><Eye size={17} />真实 3D 驾驶相机</h2><p className="mt-1 text-xs text-muted-foreground">Three.js PerspectiveCamera · 每个窗口可独立选择车辆 · 最多同时四视角</p></div>
              <div className="flex gap-1.5" aria-label="驾驶视角数量">
                {([1, 2, 4] as const).map((count) => <Button key={count} size="sm" variant={lab.driverViewCount === count ? "default" : "secondary"} onClick={() => lab.setDriverViewCount(count)}>{count} 视角</Button>)}
              </div>
            </CardHeader>
            <CardContent className={`grid gap-3 ${lab.driverViewCount > 1 ? "md:grid-cols-2" : ""}`}>
              {lab.driverVehicleIndices.slice(0, lab.driverViewCount).map((vehicleIndex, slot) => (
                <div key={slot} className="space-y-2">
                  <select aria-label={`视角 ${slot + 1} 车辆`} className="h-8 w-full rounded-control border bg-card px-2 text-xs" value={Math.min(vehicleIndex, Math.max(0, (lab.snapshot?.vehicles.length ?? lab.vehicleCount) - 1))} onChange={(event) => lab.setDriverVehicle(slot, Number(event.target.value))}>
                    {Array.from({ length: lab.snapshot?.vehicles.length ?? lab.vehicleCount }, (_, index) => <option key={index} value={index}>{lab.snapshot?.vehicles[index]?.label ?? `出租车 ${index + 1}`}</option>)}
                  </select>
                  <DriverView3D city={city} snapshot={lab.snapshot} vehicleIndex={vehicleIndex} renderFps={lab.renderFps} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Lightning size={17} />运行控制</h2></CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-xs font-medium" htmlFor="fleet-city">城市</label>
              <select id="fleet-city" className="h-9 w-full rounded-control border bg-card px-3 text-sm" value={lab.cityId} disabled={Boolean(lab.snapshot)} onChange={(event) => lab.setCityId(event.target.value)}>
                {FLEET_CITY_MAPS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>

              <div className="rounded-control border bg-[#f8faf8] p-3">
                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">实时交通车辆</span><span className="font-mono text-[10px] text-muted-foreground">单 learner · 可热调整</span></div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([4, 10, 20, 50] as const).map((count) => <Button key={count} size="sm" variant={lab.vehicleCount === count ? "default" : "secondary"} onClick={() => lab.setVehicleCount(count)}>{count} 辆</Button>)}
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">只有当前 learner 写入 Replay；其他车是可感知、可碰撞的动态交通，并会轮换成下一个 learner。改变车数不重置权重或 Replay。</p>
              </div>

              {lab.mode === "training" ? <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">训练速度</span><span className="font-mono text-[10px] text-muted-foreground">Worker 独立于 RAF</span></div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([1, 4, 16, "max"] as TrainingSpeed[]).map((speed) => <Button key={speed} size="sm" variant={lab.trainingSpeed === speed ? "default" : "secondary"} onClick={() => lab.setTrainingSpeed(speed)}>{typeof speed === "number" ? `${speed}×` : "MAX"}</Button>)}
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-muted-foreground"><span>backend {lab.runtimeMetrics.backend}</span><span>{Math.round(lab.runtimeMetrics.stepsPerSecond).toLocaleString()} step/s</span></div>
              </div> : <div>
                <div className="mb-2 text-xs font-medium">观看速度</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([0.5, 1, 2, 4] as PlaybackRate[]).map((rate) => <Button key={rate} size="sm" variant={lab.playbackRate === rate ? "default" : "secondary"} onClick={() => lab.setPlaybackRate(rate)}>{rate}×</Button>)}
                </div>
              </div>}

              <div>
                <div className="mb-2 text-xs font-medium">渲染帧率</div>
                <div className="grid grid-cols-3 gap-1.5">{([15, 30, 60] as const).map((fps) => <Button key={fps} size="sm" variant={lab.renderFps === fps ? "default" : "secondary"} onClick={() => lab.setRenderFps(fps)}>{fps} FPS</Button>)}</div>
              </div>
              <Button className="w-full" onClick={running ? lab.pause : lab.start}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停并保留上下文" : lab.snapshot ? "继续运行" : "启动共享车队"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><CarProfile size={17} />车队与订单</h2><p className="mt-1 text-xs text-muted-foreground">点击车辆切换地图高亮与驾驶员视角</p></CardHeader>
            <CardContent className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
              {lab.snapshot?.vehicles.map((vehicle, index) => (
                <button key={vehicle.id} type="button" onClick={() => lab.setSelectedVehicle(index)} className={`w-full rounded-control border p-3 text-left transition ${lab.selectedVehicle === index ? "border-primary bg-accent" : "bg-card hover:bg-muted"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold"><span className="size-2.5 rounded-full" style={{ backgroundColor: vehicle.color }} />{vehicle.label}</span><span className="font-mono text-[9px]">{index === lab.snapshot?.learnerIndex ? "LEARNER" : "ACTOR"}</span></div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>→ {vehicle.destinationLabel}</span><span>{vehicle.ordersCompleted} 单</span><span>{Math.round(vehicle.vehicle.speed)} km/h</span></div>
                </button>
              )) ?? <p className="py-6 text-center text-xs text-muted-foreground">车队尚未启动</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Gauge size={17} />轮换公平性</h2></CardHeader>
            <CardContent className="text-xs leading-6 text-muted-foreground">任一时刻只有一辆 learner。每 1,000 个车队步在全部实时交通车辆中轮换，当前剩余 <span className="font-mono font-semibold text-foreground">{lab.snapshot?.learnerStepsRemaining ?? "—"}</span> 步；所有车始终读取同一份最新权重。</CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
