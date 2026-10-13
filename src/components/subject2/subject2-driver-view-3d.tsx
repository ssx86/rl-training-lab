import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Subject2Scenario } from "@/subject2/subject2-course";
import type { Subject2Observation } from "@/subject2/subject2-environment";
import { subject2CameraElevation } from "@/subject2/subject2-camera-geometry";
import type { Subject2VehicleState } from "@/subject2/subject2-vehicle";

interface Props {
  readonly scenario: Subject2Scenario;
  readonly vehicle: Subject2VehicleState;
  readonly observation: Subject2Observation;
}

function surfaceGeometry(scenario: Subject2Scenario, points: readonly { x: number; y: number }[]): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, point.y) : shape.lineTo(point.x, point.y));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) position.setY(index, subject2CameraElevation(scenario, position.getZ(index)));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function placeSegment(
  mesh: THREE.Mesh,
  scenario: Subject2Scenario,
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  height: number,
): void {
  const start = new THREE.Vector3(a.x, subject2CameraElevation(scenario, a.y) + height / 2, a.y);
  const end = new THREE.Vector3(b.x, subject2CameraElevation(scenario, b.y) + height / 2, b.y);
  const direction = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
  mesh.scale.set(direction.length(), height, width);
}

export function Subject2DriverView3D({ scenario, vehicle, observation }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const vehicleRef = useRef(vehicle);
  useEffect(() => { vehicleRef.current = vehicle; }, [vehicle]);
  const webglAvailable = typeof WebGL2RenderingContext !== "undefined";
  const nearest = Math.min(...observation.scan.beams.map((beam) => beam.distanceMeters));

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "block size-full";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "当前训练车辆的立体驾驶员主视角");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaebfc2);
    scene.fog = new THREE.Fog(0xaebfc2, 45, 105);
    scene.add(new THREE.HemisphereLight(0xf3f6f2, 0x44544a, 2.1));
    const sun = new THREE.DirectionalLight(0xfff2d7, 2.2);
    sun.position.set(-30, 55, 26); scene.add(sun);

    const camera = new THREE.PerspectiveCamera(64, 16 / 9, .08, 125);
    scene.add(camera);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(scenario.width + 80, scenario.height + 80),
      new THREE.MeshStandardMaterial({ color: 0x627868, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.set(scenario.width / 2, -.08, scenario.height / 2); scene.add(ground);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x626b67, roughness: .94 });
    scenario.roadSurfaces.forEach((surface) => {
      const road = new THREE.Mesh(surfaceGeometry(scenario, surface.points), roadMaterial);
      road.position.y += .02; scene.add(road);
    });

    const lineGeometry = new THREE.BoxGeometry(1, 1, 1);
    scenario.segments.forEach((segment) => {
      const raised = segment.kind === "boundary" || segment.kind === "curb";
      const material = new THREE.MeshStandardMaterial({
        color: segment.kind === "exam-line" ? 0xe4a33d : raised ? 0x28332e : 0xf1efe6,
        roughness: .82,
      });
      const line = new THREE.Mesh(lineGeometry, material);
      placeSegment(line, scenario, { x: segment.ax, y: segment.ay }, { x: segment.bx, y: segment.by }, raised ? .18 : .14, raised ? .24 : .035);
      scene.add(line);
    });

    const target = scenario.checkpoints.at(-1)!;
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(.72, .07, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xe6a33b, transparent: true, opacity: .85 }),
    );
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.set(target.x, subject2CameraElevation(scenario, target.y) + .14, target.y);
    scene.add(targetRing);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.02, .16, 1.05), new THREE.MeshStandardMaterial({ color: 0xede8dd, roughness: .45 }));
    hood.position.set(0, -.78, -1.18); camera.add(hood);
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(2.25, .24, .28), new THREE.MeshStandardMaterial({ color: 0x111916, roughness: .92 }));
    dashboard.position.set(0, -.54, -.61); camera.add(dashboard);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.22, .032, 8, 24), new THREE.MeshStandardMaterial({ color: 0x080b0a, roughness: .85 }));
    wheel.position.set(-.42, -.43, -.49); wheel.rotation.x = Math.PI / 2.2; camera.add(wheel);

    const desired = new THREE.Vector3(); const lookAt = new THREE.Vector3();
    let initialized = false; let lastFrame = 0;
    renderer.setAnimationLoop((time) => {
      if (time - lastFrame < 1000 / 30) return;
      lastFrame = time;
      const current = vehicleRef.current;
      const forwardX = Math.cos(current.heading); const forwardZ = Math.sin(current.heading);
      const eyeY = subject2CameraElevation(scenario, current.y) + 1.38;
      desired.set(current.x + forwardX * .72, eyeY, current.y + forwardZ * .72);
      const lookY = subject2CameraElevation(scenario, current.y + forwardZ * 24) + 1.05;
      lookAt.set(current.x + forwardX * 24, lookY, current.y + forwardZ * 24);
      if (!initialized) { camera.position.copy(desired); initialized = true; }
      else camera.position.lerp(desired, .42);
      camera.lookAt(lookAt);
      wheel.rotation.z = -current.steer * .7;
      renderer.render(scene, camera);
    });

    const resize = () => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    return () => {
      observer.disconnect(); renderer.setAnimationLoop(null);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [scenario, webglAvailable]);

  if (!webglAvailable) return <div role="status" className="grid aspect-video place-items-center rounded-control bg-[#26332e] px-6 text-center text-xs text-white">当前浏览器没有 WebGL 2，无法启用立体驾驶员主视角。</div>;
  return (
    <div className="relative overflow-hidden rounded-control border bg-[#aebfc2]">
      <div ref={hostRef} className="aspect-video w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-2.5 text-white">
        <div className="bg-[#101b17]/85 px-2.5 py-2"><div className="text-[10px] font-semibold">驾驶员主视角</div><div className="mt-1 font-mono text-lg text-[#ffc56a]">{Math.abs(vehicle.speed * 3.6).toFixed(1)} km/h</div></div>
        <div className="bg-[#101b17]/85 px-2.5 py-2 text-right text-[10px]"><div>{vehicle.gear < 0 ? "R" : vehicle.gear > 0 ? "D" : "N"} 挡 · 最近障碍 {nearest.toFixed(1)}m</div><div className="mt-1 text-[#dce8e2]">油门 {Math.round(vehicle.throttle * 100)}% · 制动 {Math.round(vehicle.brake * 100)}%</div></div>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#101b17]/75 px-2 py-1 font-mono text-[8px] text-white">CAMERA · 30 FPS · 真实米制场地</div>
    </div>
  );
}
