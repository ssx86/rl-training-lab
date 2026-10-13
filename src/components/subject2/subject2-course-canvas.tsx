import { useId, useMemo } from "react";
import type { Subject2Point, Subject2PoseCheckpoint, Subject2Scenario } from "@/subject2/subject2-course";
import type { Subject2Observation } from "@/subject2/subject2-environment";
import { SUBJECT2_SENSOR_RANGE } from "@/subject2/subject2-sensors";
import { SUBJECT2_VEHICLE, type Subject2VehicleState } from "@/subject2/subject2-vehicle";

interface Subject2CourseCanvasProps {
  readonly vehicle: Subject2VehicleState;
  readonly observation: Subject2Observation;
  readonly checkpoint: Subject2PoseCheckpoint;
  readonly scenario: Subject2Scenario;
  readonly overview?: boolean;
}

function pathFromPoints(points: readonly Subject2Point[], smooth = false): string {
  if (points.length === 0) return "";
  if (!smooth || points.length < 3) return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const first = { x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6 };
    const second = { x: next.x - (after.x - point.x) / 6, y: next.y - (after.y - point.y) / 6 };
    return `${path} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function overviewBounds(scenario: Subject2Scenario): { x: number; y: number; width: number; height: number } {
  const points = [scenario.start, ...scenario.checkpoints, ...scenario.roadSurfaces.flatMap((surface) => surface.points)];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.max(0, Math.min(...xs) - 5);
  const minY = Math.max(0, Math.min(...ys) - 5);
  const maxX = Math.min(scenario.width, Math.max(...xs) + 5);
  const maxY = Math.min(scenario.height, Math.max(...ys) + 5);
  const width = maxX - minX;
  const height = maxY - minY;
  const desiredRatio = 4 / 3;
  if (width / height > desiredRatio) {
    const expandedHeight = width / desiredRatio;
    const y = Math.min(scenario.height - expandedHeight, Math.max(0, minY - (expandedHeight - height) / 2));
    return { x: minX, y, width, height: expandedHeight };
  }
  const expandedWidth = height * desiredRatio;
  const x = Math.min(scenario.width - expandedWidth, Math.max(0, minX - (expandedWidth - width) / 2));
  return { x, y: minY, width: expandedWidth, height };
}

export function Subject2CourseCanvas({ vehicle, observation, checkpoint, scenario, overview = false }: Subject2CourseCanvasProps) {
  const rawId = useId().replaceAll(":", "");
  const bounds = useMemo(() => overview ? overviewBounds(scenario) : ({
    x: Math.min(scenario.width - 30, Math.max(0, vehicle.x - 15)),
    y: Math.min(scenario.height - 22.5, Math.max(0, vehicle.y - 11.25)),
    width: 30,
    height: 22.5,
  }), [overview, scenario, vehicle.x, vehicle.y]);
  const viewBox = `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`;
  const headingDegrees = vehicle.heading * 180 / Math.PI;
  const targetDegrees = checkpoint.heading * 180 / Math.PI;
  const scaleX = bounds.x + 1.2;
  const scaleY = bounds.y + bounds.height - 1.4;

  return (
    <svg role="img" aria-label={overview ? `当前${scenario.label}场景总览，橙色虚线车位是当前目标姿态` : "科目二车辆局部训练视图，显示真实比例车身、道路边缘与三十二条感知射线"} viewBox={viewBox} className="block aspect-[4/3] w-full bg-[#dfe6e1]">
      <defs>
        <pattern id={`${rawId}-ground`} width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx=".35" cy=".42" r=".055" fill="#aebbb3" opacity=".5" /><circle cx="1.7" cy="1.55" r=".04" fill="#b7c2bc" opacity=".55" /></pattern>
        <pattern id={`${rawId}-asphalt`} width="1.8" height="1.8" patternUnits="userSpaceOnUse"><circle cx=".4" cy=".55" r=".035" fill="#e7ebe8" opacity=".28" /><circle cx="1.35" cy="1.1" r=".045" fill="#252d29" opacity=".16" /></pattern>
        <filter id={`${rawId}-vehicle-shadow`} x="-40%" y="-80%" width="180%" height="260%"><feDropShadow dx="0" dy=".18" stdDeviation=".18" floodColor="#17201c" floodOpacity=".3" /></filter>
      </defs>
      <rect width={scenario.width} height={scenario.height} fill={`url(#${rawId}-ground)`} />

      {scenario.roadSurfaces.map((surface) => <g key={surface.id}>
        <polygon points={surface.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={surface.kind === "parking" ? "#5e6863" : "#626c67"} />
        <polygon points={surface.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={`url(#${rawId}-asphalt)`} />
      </g>)}

      {scenario.roadMarkings.map((line) => <path key={line.id} data-testid={line.smooth ? "smooth-road-edge" : undefined} d={`${pathFromPoints(line.points, line.smooth)}${line.closed ? " Z" : ""}`} fill="none" stroke={line.kind === "exam-line" ? "#e6c368" : "#f1f0e9"} strokeWidth={line.kind === "road-edge" ? .14 : .1} strokeLinecap="round" strokeLinejoin="round" />)}

      {scenario.parkingBays.map((bay) => overview ? <text key={bay.id} x={bay.x} y={bay.y} transform={`rotate(${bay.heading * 180 / Math.PI} ${bay.x} ${bay.y})`} textAnchor="middle" dominantBaseline="middle" fontSize=".62" fontWeight="700" letterSpacing=".08" fill="#dfe4e1">{bay.label}</text> : null)}

      <g aria-label={`当前目标 ${checkpoint.label}`} transform={`translate(${checkpoint.x} ${checkpoint.y}) rotate(${targetDegrees})`}>
        <rect x={-SUBJECT2_VEHICLE.length / 2} y={-SUBJECT2_VEHICLE.width / 2} width={SUBJECT2_VEHICLE.length} height={SUBJECT2_VEHICLE.width} rx=".28" fill="rgba(217,119,6,.08)" stroke="#d97706" strokeWidth=".1" strokeDasharray=".34 .26" />
        <path d="M 1.65 0 L 2.45 0 M 2.08 -.28 L 2.45 0 L 2.08 .28" fill="none" stroke="#d97706" strokeWidth=".1" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {!overview ? observation.scan.beams.map((beam, index) => {
        const length = Math.min(SUBJECT2_SENSOR_RANGE, beam.distanceMeters);
        const endX = vehicle.x + Math.cos(beam.worldAngle) * length;
        const endY = vehicle.y + Math.sin(beam.worldAngle) * length;
        return <g key={index}><line data-testid="subject2-sensor-ray" x1={vehicle.x} y1={vehicle.y} x2={endX} y2={endY} stroke={beam.hit ? "#e6a84a" : "#f3f4ef"} strokeWidth={beam.hit ? .065 : .04} strokeOpacity={beam.hit ? .68 : .24} />{beam.hit ? <circle cx={endX} cy={endY} r=".105" fill="#e6a84a" opacity=".8" /> : null}</g>;
      }) : null}

      <g data-testid="subject2-vehicle" transform={`translate(${vehicle.x} ${vehicle.y}) rotate(${headingDegrees})`} filter={`url(#${rawId}-vehicle-shadow)`}>
        <rect x={-SUBJECT2_VEHICLE.length / 2} y={-SUBJECT2_VEHICLE.width / 2} width={SUBJECT2_VEHICLE.length} height={SUBJECT2_VEHICLE.width} rx=".42" fill="#d97706" stroke="#17201c" strokeWidth=".1" />
        <rect data-testid="subject2-wheel" x="-1.58" y="-.82" width=".72" height=".16" rx=".06" fill="#202825" /><rect data-testid="subject2-wheel" x=".88" y="-.82" width=".72" height=".16" rx=".06" fill="#202825" />
        <rect data-testid="subject2-wheel" x="-1.58" y=".66" width=".72" height=".16" rx=".06" fill="#202825" /><rect data-testid="subject2-wheel" x=".88" y=".66" width=".72" height=".16" rx=".06" fill="#202825" />
        <path d="M -1.3 -.69 Q -.92 -.79 -.55 -.7 L .92 -.7 Q 1.25 -.58 1.42 -.33 L 1.42 .33 Q 1.25 .58 .92 .7 L -.55 .7 Q -.92 .79 -1.3 .69 Z" fill="#efe8dc" stroke="#8c520d" strokeWidth=".07" />
        <path d="M .78 -.64 L 1.23 -.32 L 1.23 .32 L .78 .64 Z" fill="#6d827b" opacity=".9" /><path d="M -.98 -.64 L -.56 -.67 L -.56 .67 L -.98 .64 Z" fill="#83958f" opacity=".85" />
        <line x1=".58" y1="-.66" x2=".58" y2=".66" stroke="#8c520d" strokeWidth=".055" /><circle cx="1.94" cy="-.57" r=".11" fill="#fff2bd" /><circle cx="1.94" cy=".57" r=".11" fill="#fff2bd" />
      </g>

      <g aria-hidden="true" transform={`translate(${scaleX} ${scaleY})`}><line x1="0" y1="0" x2="5" y2="0" stroke="#17201c" strokeWidth=".09" /><line x1="0" y1="-.18" x2="0" y2=".18" stroke="#17201c" strokeWidth=".09" /><line x1="5" y1="-.18" x2="5" y2=".18" stroke="#17201c" strokeWidth=".09" /><text x="2.5" y="-.35" textAnchor="middle" fontSize=".58" fontFamily="monospace" fill="#17201c">5 m</text></g>
    </svg>
  );
}
