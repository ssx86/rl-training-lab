import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CityMap } from "@/driving/city-map";
import { createLaneRoute } from "@/driving/lane-route";
import type { SharedFleetSnapshot } from "@/driving/shared-fleet-runtime";

interface DriverView3DProps {
  readonly city: CityMap;
  readonly snapshot: SharedFleetSnapshot | null;
  readonly vehicleIndex: number;
  readonly renderFps: 15 | 30 | 60;
}

const MAX_VEHICLES = 50;

function roadSegments(city: CityMap) {
  const roads = city.roads ?? city.edges.map((edge, index) => ({
    id: `edge-${index}`,
    roadClass: edge.roadClass ?? "residential",
    roundabout: edge.roundabout ?? false,
    points: [city.nodes.find((node) => node.id === edge.from)!, city.nodes.find((node) => node.id === edge.to)!],
  }));
  return roads.flatMap((road) => road.points.slice(0, -1).map((point, index) => ({
    a: point,
    b: road.points[index + 1],
    roadClass: road.roadClass,
  })));
}

function roadWidth(baseWidth: number, roadClass: string) {
  return baseWidth * (roadClass === "primary" ? 1.65 : roadClass === "secondary" ? 1.4 : roadClass === "tertiary" ? 1.18 : roadClass === "living_street" ? .76 : 1);
}

function segmentTransform(
  object: THREE.Object3D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  elevation: number,
  width: number,
  lengthScale = 1,
) {
  const dx = b.x - a.x; const dz = b.y - a.y;
  object.position.set((a.x + b.x) / 2, elevation, (a.y + b.y) / 2);
  object.rotation.set(0, -Math.atan2(dz, dx), 0);
  object.scale.set(Math.hypot(dx, dz) * lengthScale, .12, width);
  object.updateMatrix();
}

export function DriverView3D({ city, snapshot, vehicleIndex, renderFps }: DriverView3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef(snapshot);
  const vehicleIndexRef = useRef(vehicleIndex);
  const fpsRef = useRef(renderFps);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { vehicleIndexRef.current = vehicleIndex; }, [vehicleIndex]);
  useEffect(() => { fpsRef.current = renderFps; }, [renderFps]);
  const actor = snapshot?.vehicles[vehicleIndex];
  const webglAvailable = typeof WebGL2RenderingContext !== "undefined";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable) return;

    // Three.js official docs recommend PerspectiveCamera for human-eye-like
    // projection and WebGLRenderer.setAnimationLoop for the render loop.
    // Sources: https://threejs.org/docs/pages/PerspectiveCamera.html
    // https://threejs.org/docs/pages/WebGLRenderer.html#setAnimationLoop
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x9fb8c0, 1);
    renderer.domElement.className = "block size-full";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Three.js 真实驾驶相机");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fb8c0);
    scene.fog = new THREE.Fog(0x9fb8c0, 78, 165);
    const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 180);
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xe8f1ee, 0x405347, 2.25));
    const sun = new THREE.DirectionalLight(0xfff4de, 2.4);
    sun.position.set(-45, 80, 30);
    scene.add(sun);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x476451, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(city.width + 320, city.height + 320), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(city.width / 2, -0.08, city.height / 2);
    scene.add(ground);

    const segments = roadSegments(city);
    // InstancedMesh keeps hundreds of road/building objects to a small number
    // of draw calls. Source: https://threejs.org/docs/pages/InstancedMesh.html
    const roadGeometry = new THREE.BoxGeometry(1, 1, 1);
    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0xb6b9b2, roughness: 1 });
    const shoulders = new THREE.InstancedMesh(roadGeometry, shoulderMaterial, segments.length);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x5e6864, roughness: .92, metalness: 0 });
    const roads = new THREE.InstancedMesh(roadGeometry, roadMaterial, segments.length);
    const matrixObject = new THREE.Object3D();
    segments.forEach((segment, index) => {
      const width = roadWidth(city.renderRoadWidth ?? city.roadWidth, segment.roadClass);
      segmentTransform(matrixObject, segment.a, segment.b, -.015, width + 1.25);
      shoulders.setMatrixAt(index, matrixObject.matrix);
      segmentTransform(matrixObject, segment.a, segment.b, .055, width);
      roads.setMatrixAt(index, matrixObject.matrix);
    });
    shoulders.instanceMatrix.needsUpdate = true; roads.instanceMatrix.needsUpdate = true;
    scene.add(shoulders, roads);

    const nodeGeometry = new THREE.CylinderGeometry(1, 1, .12, 16);
    const nodePads = new THREE.InstancedMesh(nodeGeometry, roadMaterial, city.nodes.length);
    city.nodes.forEach((node, index) => {
      const connected = city.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
      const width = connected.reduce((largest, edge) => Math.max(largest, roadWidth(city.renderRoadWidth ?? city.roadWidth, edge.roadClass ?? "residential")), city.renderRoadWidth ?? city.roadWidth);
      matrixObject.position.set(node.x, .06, node.y);
      matrixObject.rotation.set(0, 0, 0); matrixObject.scale.set(width / 2, 1, width / 2);
      matrixObject.updateMatrix(); nodePads.setMatrixAt(index, matrixObject.matrix);
    });
    nodePads.instanceMatrix.needsUpdate = true; scene.add(nodePads);

    const markedSegments = segments.filter((segment) => segment.roadClass !== "living_street");
    const dashInstances = markedSegments.flatMap((segment) => {
      const length = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      const count = Math.max(1, Math.floor(length / 10));
      return Array.from({ length: count }, (_, index) => {
        const start = (index + .22) / count; const end = Math.min(1, start + .44 / count);
        return {
          a: { x: segment.a.x + (segment.b.x - segment.a.x) * start, y: segment.a.y + (segment.b.y - segment.a.y) * start },
          b: { x: segment.a.x + (segment.b.x - segment.a.x) * end, y: segment.a.y + (segment.b.y - segment.a.y) * end },
        };
      });
    });
    const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xe9e7dc });
    const laneGeometry = new THREE.BoxGeometry(1, 1, 1);
    const lanes = new THREE.InstancedMesh(laneGeometry, laneMaterial, dashInstances.length);
    dashInstances.forEach((dash, index) => {
      segmentTransform(matrixObject, dash.a, dash.b, .14, .16);
      lanes.setMatrixAt(index, matrixObject.matrix);
    });
    lanes.instanceMatrix.needsUpdate = true;
    scene.add(lanes);

    const navigationMaterial = new THREE.LineBasicMaterial({ color: 0xffb23f, transparent: true, opacity: .92 });
    const navigationLine = new THREE.Line(new THREE.BufferGeometry(), navigationMaterial);
    scene.add(navigationLine);
    const destinationBeacon = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, .16, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb23f, transparent: true, opacity: .9 }),
    );
    destinationBeacon.rotation.x = Math.PI / 2;
    destinationBeacon.visible = false;
    scene.add(destinationBeacon);
    let navigationKey = "";

    const buildings = city.objects.filter((object) => object.kind === "building");
    if (buildings.length) {
      const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
      const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xaebbb5, roughness: .88 });
      const buildingMesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildings.length);
      buildings.forEach((building, index) => {
        const hash = [...building.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
        const height = 6 + (hash % 15);
        matrixObject.position.set(building.x, height / 2, building.y);
        matrixObject.rotation.set(0, (hash % 8) * Math.PI / 16, 0);
        matrixObject.scale.set(building.size, height, building.size * .78);
        matrixObject.updateMatrix(); buildingMesh.setMatrixAt(index, matrixObject.matrix);
        buildingMesh.setColorAt(index, new THREE.Color([0xaebbb5, 0xb7afa3, 0x9eaaa3, 0xc3beb0][hash % 4]));
      });
      buildingMesh.instanceMatrix.needsUpdate = true;
      if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
      scene.add(buildingMesh);
    }

    const trees = city.objects.filter((object) => object.kind === "tree");
    if (trees.length) {
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x624b36, roughness: 1 }), trees.length);
      const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 4.4, 8), new THREE.MeshStandardMaterial({ color: 0x315f43, roughness: 1 }), trees.length);
      trees.forEach((tree, index) => {
        matrixObject.position.set(tree.x, 1.1, tree.y); matrixObject.rotation.set(0, 0, 0); matrixObject.scale.set(1, 1, 1); matrixObject.updateMatrix(); trunks.setMatrixAt(index, matrixObject.matrix);
        matrixObject.position.set(tree.x, 4.1, tree.y); matrixObject.scale.set(Math.max(.7, tree.size / 4), Math.max(.8, tree.size / 4), Math.max(.7, tree.size / 4)); matrixObject.updateMatrix(); crowns.setMatrixAt(index, matrixObject.matrix);
      });
      trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true; scene.add(trunks, crowns);
    }

    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .08 }), MAX_VEHICLES);
    const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xd8e6e0, roughness: .32 }), MAX_VEHICLES);
    const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x263b42, roughness: .16, metalness: .18 }), MAX_VEHICLES);
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffce78 }), MAX_VEHICLES);
    const taxiSigns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffbf47 }), MAX_VEHICLES);
    const wheels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x151917, roughness: .9 }), MAX_VEHICLES * 4);
    scene.add(body, roof, glass, lights, taxiSigns, wheels);

    const cockpitMaterial = new THREE.MeshStandardMaterial({ color: 0x17221e, roughness: .72 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.15, .22, 1.12), cockpitMaterial);
    hood.position.set(0, -.83, -1.45); camera.add(hood);
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(2.3, .28, .3), new THREE.MeshStandardMaterial({ color: 0x101714, roughness: .9 }));
    dashboard.position.set(0, -.58, -.72); camera.add(dashboard);
    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(.24, .035, 8, 20), new THREE.MeshStandardMaterial({ color: 0x060807, roughness: .8 }));
    steeringWheel.position.set(-.43, -.46, -.56); steeringWheel.rotation.x = Math.PI / 2.25; camera.add(steeringWheel);

    const cameraPosition = new THREE.Vector3();
    const desiredPosition = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    let cameraInitialized = false;
    let lastFrame = 0;
    const updateInstance = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, heading: number, sx: number, sy: number, sz: number) => {
      matrixObject.position.set(x, y, z);
      matrixObject.rotation.set(0, -heading, 0);
      matrixObject.scale.set(sx, sy, sz);
      matrixObject.updateMatrix(); mesh.setMatrixAt(index, matrixObject.matrix);
    };

    renderer.setAnimationLoop((time) => {
      if (time - lastFrame < 1000 / fpsRef.current) return;
      lastFrame = time;
      const current = snapshotRef.current;
      const selectedIndex = Math.min(vehicleIndexRef.current, Math.max(0, (current?.vehicles.length ?? 1) - 1));
      if (current?.vehicles.length) {
        body.count = current.vehicles.length; roof.count = current.vehicles.length; glass.count = current.vehicles.length;
        lights.count = current.vehicles.length; taxiSigns.count = current.vehicles.length; wheels.count = current.vehicles.length * 4;
        current.vehicles.forEach((vehicle, index) => {
          const hidden = index === selectedIndex ? .001 : 1;
          const heading = vehicle.vehicle.heading;
          const forwardX = Math.cos(heading); const forwardZ = Math.sin(heading);
          const sideX = -Math.sin(heading); const sideZ = Math.cos(heading);
          updateInstance(body, index, vehicle.vehicle.x, .64, vehicle.vehicle.y, vehicle.vehicle.heading, 4.5 * hidden, 1.05 * hidden, 2 * hidden);
          updateInstance(roof, index, vehicle.vehicle.x - forwardX * .25, 1.25, vehicle.vehicle.y - forwardZ * .25, heading, 2.45 * hidden, .68 * hidden, 1.7 * hidden);
          updateInstance(glass, index, vehicle.vehicle.x + forwardX * .48, 1.35, vehicle.vehicle.y + forwardZ * .48, heading, .12 * hidden, .54 * hidden, 1.55 * hidden);
          updateInstance(lights, index, vehicle.vehicle.x + forwardX * 2.2, .7, vehicle.vehicle.y + forwardZ * 2.2, heading, .16 * hidden, .24 * hidden, 1.45 * hidden);
          updateInstance(taxiSigns, index, vehicle.vehicle.x - forwardX * .12, 1.68, vehicle.vehicle.y - forwardZ * .12, heading, .72 * hidden, .24 * hidden, .34 * hidden);
          [[1.45, -.92], [1.45, .92], [-1.42, -.92], [-1.42, .92]].forEach(([forward, side], wheelIndex) => {
            updateInstance(wheels, index * 4 + wheelIndex, vehicle.vehicle.x + forwardX * forward + sideX * side, .38, vehicle.vehicle.y + forwardZ * forward + sideZ * side, heading, .62 * hidden, .58 * hidden, .22 * hidden);
          });
          body.setColorAt(index, new THREE.Color(vehicle.color));
        });
        body.instanceMatrix.needsUpdate = true; roof.instanceMatrix.needsUpdate = true; glass.instanceMatrix.needsUpdate = true;
        lights.instanceMatrix.needsUpdate = true; taxiSigns.instanceMatrix.needsUpdate = true; wheels.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;

        const selected = current.vehicles[selectedIndex];
        const nextNavigationKey = `${selected.id}:${selected.startNodeId}->${selected.destinationNodeId}`;
        if (nextNavigationKey !== navigationKey) {
          navigationKey = nextNavigationKey;
          const route = createLaneRoute(city, selected.startNodeId, selected.destinationNodeId);
          navigationLine.geometry.dispose();
          navigationLine.geometry = new THREE.BufferGeometry().setFromPoints(route.map((point) => new THREE.Vector3(point.x, .19, point.y)));
          const destination = route.at(-1)!;
          destinationBeacon.position.set(destination.x, .24, destination.y);
          destinationBeacon.visible = true;
        }
        const forwardX = Math.cos(selected.vehicle.heading); const forwardZ = Math.sin(selected.vehicle.heading);
        desiredPosition.set(selected.vehicle.x + forwardX * 1.55, 1.72, selected.vehicle.y + forwardZ * 1.55);
        lookTarget.set(selected.vehicle.x + forwardX * 34, 1.25, selected.vehicle.y + forwardZ * 34);
        if (!cameraInitialized) { camera.position.copy(desiredPosition); cameraInitialized = true; }
        else camera.position.lerp(desiredPosition, .34);
        cameraPosition.copy(lookTarget);
        camera.lookAt(cameraPosition);
      }
      renderer.render(scene, camera);
    });

    const resize = () => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host); resize();

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [city, webglAvailable]);

  if (!webglAvailable) {
    return <div role="status" className="flex aspect-video items-center justify-center rounded-control bg-[#26332e] px-6 text-center text-xs text-white">当前浏览器没有 WebGL 2，无法启用真实 3D camera。</div>;
  }

  return (
    <div className="relative overflow-hidden rounded-control border bg-[#9fb8c0]">
      <div ref={hostRef} className="aspect-video w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-2.5">
        <div className="bg-[#101b17]/85 px-2.5 py-2 text-white shadow-sm">
          <div className="text-[10px] font-semibold">{actor?.label ?? "等待车队"}</div>
          <div className="mt-1 font-mono text-base text-[#ffc56a]">{Math.round(actor?.vehicle.speed ?? 0)} km/h</div>
        </div>
        <div className="max-w-[58%] bg-[#101b17]/85 px-2.5 py-2 text-right text-white shadow-sm">
          <div className="truncate text-[10px]">目的地 · {actor?.destinationLabel ?? "—"}</div>
          <div className="mt-1 truncate text-[10px] text-[#dce8e2]">{actor?.actionLabel ?? "等待策略"}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#101b17]/75 px-2 py-1 font-mono text-[8px] text-white">CAMERA {vehicleIndex + 1} · 琥珀线为导航车道</div>
    </div>
  );
}
