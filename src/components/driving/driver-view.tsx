import { useEffect, useRef } from "react";
import type { SharedFleetSnapshot } from "@/driving/shared-fleet-runtime";
import { URBAN_SENSOR_MAX_DISTANCE } from "@/driving/sensors";
import { buildDriverRoadProjection, type ScreenPoint } from "@/driving/driver-projection";

interface DriverViewProps { snapshot: SharedFleetSnapshot | null; vehicleIndex: number; }

const CAMERA_NEAR_METERS = 3;
const CAMERA_FAR_METERS = 64;
const CAMERA_HALF_FOV = Math.PI * 0.22;

export function DriverView({ snapshot, vehicleIndex }: DriverViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actor = snapshot?.vehicles[vehicleIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = 640; const height = 360; const horizon = 122;
    canvas.width = width * (window.devicePixelRatio || 1);
    canvas.height = height * (window.devicePixelRatio || 1);
    context.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#9fb8c0"); sky.addColorStop(1, "#dfe8e5");
    context.fillStyle = sky; context.fillRect(0, 0, width, horizon);
    context.fillStyle = "#43624f"; context.fillRect(0, horizon, width, height - horizon);

    const drawPolyline = (points: readonly ScreenPoint[]) => {
      context.beginPath();
      points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      context.stroke();
    };
    if (snapshot && actor) {
      const road = buildDriverRoadProjection(snapshot.city, actor.vehicle, actor.startNodeId, actor.destinationNodeId, {
        width, height, horizon, nearMeters: CAMERA_NEAR_METERS, farMeters: CAMERA_FAR_METERS, focalLength: 390,
      });
      if (road.center.length >= 2) {
        context.fillStyle = "#59635f"; context.beginPath();
        road.left.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
        [...road.right].reverse().forEach((point) => context.lineTo(point.x, point.y));
        context.closePath(); context.fill();
        context.strokeStyle = "#d9ddd8"; context.lineWidth = 4; context.setLineDash([]);
        drawPolyline(road.left); drawPolyline(road.right);
        context.strokeStyle = "#f1eee5"; context.lineWidth = 3; context.setLineDash([12, 11]); drawPolyline(road.center); context.setLineDash([]);
      }
    } else {
      context.fillStyle = "#59635f"; context.beginPath(); context.moveTo(248, horizon); context.lineTo(392, horizon); context.lineTo(610, height); context.lineTo(30, height); context.closePath(); context.fill();
      context.strokeStyle = "#f1eee5"; context.lineWidth = 4; context.setLineDash([18, 15]); context.beginPath(); context.moveTo(320, horizon); context.lineTo(320, height); context.stroke(); context.setLineDash([]);
      context.strokeStyle = "#d9ddd8"; context.lineWidth = 5; context.beginPath(); context.moveTo(248, horizon); context.lineTo(30, height); context.moveTo(392, horizon); context.lineTo(610, height); context.stroke();
    }

    if (snapshot && actor) {
      const visible = [
        ...snapshot.city.objects.map((object) => ({ ...object, label: object.kind === "building" ? "建筑" : object.kind === "tree" ? "树木" : object.kind === "barrier" ? "路障" : "出租车站" })),
        ...snapshot.vehicles.filter((vehicle) => vehicle.id !== actor.id).map((vehicle) => ({ x: vehicle.vehicle.x, y: vehicle.vehicle.y, size: 2.2, kind: "vehicle", label: vehicle.label })),
      ].map((object) => {
        const dx = object.x - actor.vehicle.x; const dy = object.y - actor.vehicle.y;
        const forward = Math.cos(actor.vehicle.heading) * dx + Math.sin(actor.vehicle.heading) * dy;
        const lateral = -Math.sin(actor.vehicle.heading) * dx + Math.cos(actor.vehicle.heading) * dy;
        return { ...object, forward, lateral };
      }).filter((object) => {
        if (object.forward <= CAMERA_NEAR_METERS || object.forward > CAMERA_FAR_METERS) return false;
        return Math.abs(Math.atan2(object.lateral, object.forward)) <= CAMERA_HALF_FOV;
      }).sort((a, b) => b.forward - a.forward).slice(0, 14);

      visible.forEach((object) => {
        const focalLength = 390;
        const x = width / 2 + (object.lateral / object.forward) * focalLength;
        const groundY = horizon + (CAMERA_NEAR_METERS / object.forward) * (height - horizon);
        const heightPixels = Math.max(7, Math.min(122, object.size * focalLength / object.forward));
        const widthPixels = object.kind === "vehicle" ? heightPixels * 1.35 : heightPixels * .9;
        context.fillStyle = object.kind === "vehicle" ? "#d97706" : object.kind === "tree" ? "#315c43" : object.kind === "barrier" ? "#252d2a" : "#aab5b0";
        if (object.kind === "tree") { context.beginPath(); context.arc(x, groundY - heightPixels * .7, widthPixels * .62, 0, Math.PI * 2); context.fill(); }
        else {
          context.fillRect(x - widthPixels / 2, groundY - heightPixels, widthPixels, heightPixels);
          context.fillStyle = "rgba(255,255,255,.12)";
          context.fillRect(x - widthPixels * .32, groundY - heightPixels * .78, widthPixels * .64, heightPixels * .22);
        }
        if (object.kind !== "building" || object.forward <= 26) {
          const labelWidth = object.kind === "vehicle" ? 72 : 48;
          context.fillStyle = "rgba(18,31,26,.82)"; context.fillRect(x - labelWidth / 2, groundY - heightPixels - 18, labelWidth, 14);
          context.fillStyle = "white"; context.font = "9px ui-sans-serif"; context.textAlign = "center"; context.fillText(`${object.label} · ${Math.round(object.forward)}m`, x, groundY - heightPixels - 8);
        }
      });
      context.textAlign = "left";
      context.fillStyle = "rgba(11,20,17,.82)"; context.fillRect(16, 16, 190, 62);
      context.fillStyle = "#f4f7f5"; context.font = "600 13px ui-sans-serif"; context.fillText(actor.label, 28, 37);
      context.fillStyle = "#f3b24b"; context.font = "24px ui-monospace"; context.fillText(`${Math.round(actor.vehicle.speed)} km/h`, 28, 65);
      context.fillStyle = "rgba(11,20,17,.82)"; context.fillRect(430, 16, 194, 62);
      context.fillStyle = "#f4f7f5"; context.font = "12px ui-sans-serif"; context.fillText(`目的地 · ${actor.destinationLabel}`, 444, 39);
      context.fillStyle = "#d8e3de"; context.fillText(actor.actionLabel ?? "等待策略", 444, 62);
      context.fillStyle = "rgba(11,20,17,.72)"; context.fillRect(248, 326, 144, 22);
      context.fillStyle = "#d8e3de"; context.font = "10px ui-monospace"; context.textAlign = "center";
      context.fillText(`局部视距 ${CAMERA_FAR_METERS}m · 雷达 ${URBAN_SENSOR_MAX_DISTANCE}m`, 320, 341);
    }
  }, [actor, snapshot]);

  return <canvas ref={canvasRef} className="aspect-video w-full rounded-control bg-[#9fb8c0]" role="img" aria-label={actor ? `${actor.label}驾驶员视角` : "驾驶员视角等待车队运行"} />;
}
