import { CrosshairSimple, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CityMap } from "@/driving/city-map";
import { createLaneRoute } from "@/driving/lane-route";
import type { SharedFleetSnapshot } from "@/driving/shared-fleet-runtime";
import { RADAR_MAX_DISTANCE } from "@/driving/radar";

interface FleetCityCanvasProps {
  city: CityMap;
  snapshot: SharedFleetSnapshot | null;
  selectedVehicle: number;
}

export function FleetCityCanvas({ city, snapshot, selectedVehicle }: FleetCityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const initializedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [camera, setCamera] = useState({ zoom: 1, panX: 0, panY: 0, follow: false });

  useEffect(() => {
    if (snapshot?.vehicles.length && !initializedRef.current) {
      initializedRef.current = true;
      setCamera({ zoom: 4, panX: 0, panY: 0, follow: true });
    }
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = city.width * ratio;
    canvas.height = city.height * ratio;
    context.scale(ratio, ratio);
    context.fillStyle = "#dce5df";
    context.fillRect(0, 0, city.width, city.height);

    const followed = camera.follow ? snapshot?.vehicles[selectedVehicle]?.vehicle : null;
    const panX = followed ? -camera.zoom * (followed.x - city.width / 2) : camera.panX;
    const panY = followed ? -camera.zoom * (followed.y - city.height / 2) : camera.panY;
    context.save();
    context.translate(city.width / 2 + panX, city.height / 2 + panY);
    context.scale(camera.zoom, camera.zoom);
    context.translate(-city.width / 2, -city.height / 2);

    const roads = city.roads ?? city.edges.map((edge, index) => ({
      id: `edge-${index}`,
      roadClass: edge.roadClass ?? "residential",
      roundabout: edge.roundabout ?? false,
      points: [city.nodes.find((node) => node.id === edge.from)!, city.nodes.find((node) => node.id === edge.to)!],
    }));
    const baseWidth = city.renderRoadWidth ?? city.roadWidth;
    const roadWidth = (roadClass: string) => baseWidth * (roadClass === "secondary" ? 1.45 : roadClass === "tertiary" ? 1.2 : roadClass === "living_street" ? .78 : 1);
    const strokeRoad = (road: (typeof roads)[number], color: string, width: number) => {
      context.strokeStyle = color; context.lineWidth = width; context.lineCap = "round"; context.lineJoin = "round";
      context.beginPath();
      road.points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      context.stroke();
    };
    roads.forEach((road) => strokeRoad(road, "#4b5954", roadWidth(road.roadClass) + 3));
    roads.forEach((road) => strokeRoad(road, road.roundabout ? "#697872" : "#77837e", roadWidth(road.roadClass)));
    roads.filter((road) => road.roadClass === "secondary" || road.roadClass === "tertiary").forEach((road) => {
      context.setLineDash([7, 7]); strokeRoad(road, "rgba(246,247,244,.68)", 1.2); context.setLineDash([]);
    });

    for (const object of city.objects) {
      if (object.kind === "building") {
        context.fillStyle = city.roads ? "#c3ccc7" : "#b7c1bc";
        context.strokeStyle = "#9eaaa4";
        context.lineWidth = 1;
        const size = city.roads ? object.size * 1.15 : object.size;
        context.fillRect(object.x - size / 2, object.y - size / 2, size, size);
        context.strokeRect(object.x - size / 2, object.y - size / 2, size, size);
      } else if (object.kind === "tree") {
        context.fillStyle = "#426b55"; context.beginPath(); context.arc(object.x, object.y, object.size, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#6f917c"; context.beginPath(); context.arc(object.x - 4, object.y - 5, object.size * .55, 0, Math.PI * 2); context.fill();
      } else if (object.kind === "barrier") {
        context.fillStyle = "#252d2a"; context.fillRect(object.x - object.size, object.y - 7, object.size * 2, 14);
        context.fillStyle = "#d97706"; context.fillRect(object.x - object.size + 4, object.y - 5, 7, 10);
      } else {
        context.fillStyle = "#d97706"; context.beginPath(); context.arc(object.x, object.y, object.size, 0, Math.PI * 2); context.fill();
      }
    }

    const destinations = new Set(city.destinationNodeIds ?? city.nodes.map((node) => node.id));
    city.nodes.forEach((node) => {
      if (!destinations.has(node.id)) return;
      context.fillStyle = "rgba(255,255,255,.82)"; context.beginPath(); context.arc(node.x, node.y, 3, 0, Math.PI * 2); context.fill();
    });

    snapshot?.vehicles.forEach((actor, index) => {
      const route = createLaneRoute(city, actor.startNodeId, actor.destinationNodeId);
      context.strokeStyle = actor.color; context.globalAlpha = index === selectedVehicle ? .8 : .22; context.lineWidth = index === selectedVehicle ? 2.4 : 1.2; context.setLineDash([5, 5]);
      context.beginPath(); route.forEach((point, routeIndex) => routeIndex === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)); context.stroke();
      context.setLineDash([]); context.globalAlpha = 1;
      context.save(); context.translate(actor.vehicle.x, actor.vehicle.y); context.rotate(actor.vehicle.heading);
      if (index === snapshot.learnerIndex) { context.shadowColor = "#f59e0b"; context.shadowBlur = 18; }
      context.fillStyle = actor.color; context.strokeStyle = index === selectedVehicle ? "#fff7e6" : "#16231f"; context.lineWidth = index === selectedVehicle ? 4 : 2;
      context.beginPath(); context.roundRect(-3.6, -1.9, 7.2, 3.8, 1.1); context.fill(); context.stroke();
      context.fillStyle = "#dbe9e3"; context.fillRect(-.8, -1.45, 2.3, 2.9);
      context.fillStyle = "#ffd08a"; context.fillRect(2.7, -1.35, .8, .8); context.fillRect(2.7, .55, .8, .8);
      context.restore();
      if (index === selectedVehicle || index === snapshot.learnerIndex) {
        const labelY = actor.vehicle.y - 9 - index * 1.5;
        context.fillStyle = "rgba(20,36,30,.84)"; context.fillRect(actor.vehicle.x - 21, labelY - 10, 42, 13);
        context.fillStyle = "white"; context.font = "600 8px ui-sans-serif"; context.textAlign = "center"; context.fillText(actor.label, actor.vehicle.x, labelY); context.textAlign = "left";
      }
    });
    const selectedActor = snapshot?.vehicles[selectedVehicle];
    if (selectedActor) {
      const radarColors = { "road-edge": "rgba(217,119,6,.7)", vehicle: "rgba(180,35,24,.82)", structure: "rgba(32,75,63,.68)", destination: "rgba(33,95,150,.72)" };
      selectedActor.radar.beams.forEach((beam) => {
        const nearest = Object.entries(beam.distances).sort((first, second) => first[1] - second[1])[0] as [keyof typeof radarColors, number];
        const length = nearest[1] * RADAR_MAX_DISTANCE;
        const angle = selectedActor.vehicle.heading + beam.angle;
        context.strokeStyle = radarColors[nearest[0]]; context.lineWidth = .55;
        context.beginPath(); context.moveTo(selectedActor.vehicle.x, selectedActor.vehicle.y);
        context.lineTo(selectedActor.vehicle.x + Math.cos(angle) * length, selectedActor.vehicle.y + Math.sin(angle) * length); context.stroke();
      });
    }
    snapshot?.accidents.forEach((accident) => {
      context.strokeStyle = "#b42318"; context.lineWidth = 2; context.beginPath(); context.arc(accident.x, accident.y, 7, 0, Math.PI * 2); context.stroke();
      context.fillStyle = "rgba(180,35,24,.88)"; context.fillRect(accident.x - 27, accident.y - 22, 54, 14);
      context.fillStyle = "white"; context.font = "8px ui-monospace"; context.textAlign = "center"; context.fillText(`事故 ${accident.remainingSteps}`, accident.x, accident.y - 12); context.textAlign = "left";
    });
    context.restore();
  }, [camera, city, selectedVehicle, snapshot]);

  const changeZoom = (nextZoom: number) => setCamera((current) => ({
    ...current,
    zoom: Math.max(1, Math.min(10, nextZoom)),
    follow: current.follow,
  }));

  const fitMap = () => setCamera({ zoom: 1, panX: 0, panY: 0, follow: false });

  const followVehicle = () => setCamera((current) => ({ ...current, zoom: Math.max(4, current.zoom), follow: true }));

  return (
    <div className="relative overflow-hidden rounded-control bg-[#dce5df]">
      <canvas
        ref={canvasRef}
        className={`block w-full touch-none bg-[#dce5df] ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ aspectRatio: `${city.width} / ${city.height}` }}
        role="img"
        aria-label={`${city.name}可缩放多车出租车训练地图，${snapshot?.vehicles.length ?? 0} 辆车`}
        onWheel={(event) => {
          event.preventDefault();
          const canvas = canvasRef.current;
          if (!canvas) return;
          const bounds = canvas.getBoundingClientRect();
          const pointerX = (event.clientX - bounds.left) * city.width / bounds.width;
          const pointerY = (event.clientY - bounds.top) * city.height / bounds.height;
          setCamera((current) => {
            const nextZoom = Math.max(1, Math.min(10, current.zoom * (event.deltaY < 0 ? 1.22 : 1 / 1.22)));
            const worldX = (pointerX - city.width / 2 - current.panX) / current.zoom + city.width / 2;
            const worldY = (pointerY - city.height / 2 - current.panY) / current.zoom + city.height / 2;
            return {
              zoom: nextZoom,
              panX: pointerX - city.width / 2 - nextZoom * (worldX - city.width / 2),
              panY: pointerY - city.height / 2 - nextZoom * (worldY - city.height / 2),
              follow: false,
            };
          });
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, panX: camera.panX, panY: camera.panY };
          setIsDragging(true);
          setCamera((current) => ({ ...current, follow: false }));
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current; const canvas = canvasRef.current;
          if (!drag || !canvas) return;
          const bounds = canvas.getBoundingClientRect();
          setCamera((current) => ({
            ...current,
            panX: drag.panX + (event.clientX - drag.x) * city.width / bounds.width,
            panY: drag.panY + (event.clientY - drag.y) * city.height / bounds.height,
            follow: false,
          }));
        }}
        onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); dragRef.current = null; setIsDragging(false); }}
        onPointerCancel={() => { dragRef.current = null; setIsDragging(false); }}
      />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-control border border-white/40 bg-[#17251f]/88 p-1 text-white shadow-lg">
        <Button aria-label="缩小地图" size="icon" variant="ghost" className="size-7 text-white hover:bg-white/15 hover:text-white" onClick={() => changeZoom(camera.zoom / 1.5)}><MagnifyingGlassMinus size={15} /></Button>
        <span className="min-w-11 text-center font-mono text-[10px]">{camera.zoom.toFixed(1)}×</span>
        <Button aria-label="放大地图" size="icon" variant="ghost" className="size-7 text-white hover:bg-white/15 hover:text-white" onClick={() => changeZoom(camera.zoom * 1.5)}><MagnifyingGlassPlus size={15} /></Button>
        <Button aria-label="跟随选中车辆" size="sm" variant="ghost" className={camera.follow ? "bg-white/15 text-white" : "text-white hover:bg-white/15 hover:text-white"} onClick={followVehicle}><CrosshairSimple size={14} />跟车</Button>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={fitMap}>全图</Button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 bg-[#17251f]/82 px-2 py-1 font-mono text-[9px] text-white">
        视野宽度约 {Math.round(city.width / camera.zoom)}m · 雷达 {RADAR_MAX_DISTANCE}m / 21×4
      </div>
    </div>
  );
}
