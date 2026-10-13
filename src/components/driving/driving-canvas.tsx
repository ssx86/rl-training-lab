import { SENSOR_ANGLES, SENSOR_MAX_DISTANCE } from "@/driving/sensors";
import type { DrivingMap } from "@/driving/maps";
import type { DrivingObservation } from "@/driving/types";
import type { VehicleState } from "@/driving/vehicle-model";

interface DrivingCanvasProps {
  map: DrivingMap;
  vehicle: VehicleState;
  observation: DrivingObservation;
}

const SENSOR_FIELDS = [
  "lidarFarLeft",
  "lidarLeft",
  "lidarFront",
  "lidarRight",
  "lidarFarRight",
] as const;

export function DrivingCanvas({ map, vehicle, observation }: DrivingCanvasProps) {
  const routePoints = map.route.map((point) => `${point.x},${point.y}`).join(" ");
  const goal = map.route[map.route.length - 1];
  const headingDegrees = (vehicle.heading * 180) / Math.PI;
  const nearestDistance = Math.min(
    ...SENSOR_FIELDS.map((field) => observation[field]),
  );

  return (
    <div className="overflow-hidden rounded-panel border bg-[#edf0ee]">
      <svg
        role="img"
        aria-label="自动驾驶环境：道路、车辆、障碍物和五条距离传感器"
        viewBox={`0 0 ${map.width} ${map.height}`}
        className="block aspect-[3/2] w-full"
      >
        <defs>
          <pattern id="obstacle-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#4d5551" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#78817c" strokeWidth="3" />
          </pattern>
        </defs>
        <rect width={map.width} height={map.height} fill="#e5e9e6" />
        <polyline
          points={routePoints}
          fill="none"
          stroke="#c7ceca"
          strokeWidth={map.roadHalfWidth * 2 + 4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={routePoints}
          fill="none"
          stroke="#ffffff"
          strokeWidth={map.roadHalfWidth * 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={routePoints}
          fill="none"
          stroke="#b9c1bd"
          strokeWidth="2"
          strokeDasharray="14 12"
          strokeLinejoin="round"
        />

        {map.obstacles.map((obstacle) => (
          <g key={obstacle.id} data-testid={`obstacle-${obstacle.id}`}>
            <circle
              cx={obstacle.x}
              cy={obstacle.y}
              r={obstacle.radius + 12}
              fill="none"
              stroke="#b6463a"
              strokeOpacity="0.28"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <circle
              cx={obstacle.x}
              cy={obstacle.y}
              r={obstacle.radius}
              fill="url(#obstacle-hatch)"
              stroke="#2f3432"
              strokeWidth="2"
            />
          </g>
        ))}

        <circle cx={goal.x} cy={goal.y} r={map.goalRadius} fill="#fff7e8" stroke="#d97706" strokeWidth="4" />
        <circle cx={goal.x} cy={goal.y} r={map.goalRadius - 9} fill="none" stroke="#d97706" strokeWidth="2" />

        {SENSOR_ANGLES.map((angle, index) => {
          const distance = observation[SENSOR_FIELDS[index]] * SENSOR_MAX_DISTANCE;
          const sensorAngle = vehicle.heading + angle;
          const dangerous = observation[SENSOR_FIELDS[index]] < 0.15;
          return (
            <line
              key={angle}
              data-testid="sensor-ray"
              x1={vehicle.x}
              y1={vehicle.y}
              x2={vehicle.x + Math.cos(sensorAngle) * distance}
              y2={vehicle.y + Math.sin(sensorAngle) * distance}
              stroke={dangerous ? "#b6463a" : "#d97706"}
              strokeWidth={dangerous ? 4 : 2}
              strokeOpacity={dangerous ? 0.9 : 0.55}
              strokeLinecap="round"
            />
          );
        })}

        <g transform={`translate(${vehicle.x} ${vehicle.y}) rotate(${headingDegrees})`}>
          <rect x="-14" y="-9" width="28" height="18" rx="4" fill="#17201c" />
          <line x1="4" y1="0" x2="17" y2="0" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
      <p className="border-t bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground">
        路线进度 {Math.round(observation.routeProgress * 100)}% · 速度 {Math.round(observation.speed * 80)} · 最近风险 {Math.round(nearestDistance * SENSOR_MAX_DISTANCE)}
      </p>
    </div>
  );
}
