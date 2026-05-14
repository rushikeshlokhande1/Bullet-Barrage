import * as THREE from "three";
import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FirstPersonGun } from "./FirstPersonGun";
import type { PlayerState, WeaponId } from "../types/game";
import { WEAPONS } from "../types/game";

const SPEED = 9;
const JUMP_FORCE = 7;
const GRAVITY = -20;
const PLAYER_HEIGHT = 1.75;
const MAP_BOUND = 60;

interface Props {
  self: PlayerState;
  players: Map<string, PlayerState>;
  onMove: (pos: { x: number; y: number; z: number }, rot: { x: number; y: number }) => void;
  onShoot: (targetId: string, damage: number) => void;
  onAmmoChange: (ammo: number, reloading: boolean) => void;
  onMuzzleFlash: () => void;
  onHitConfirmed: () => void;
  onWeaponChange: (w: WeaponId) => void;
  onImpact: (pos: THREE.Vector3) => void;
  alive: boolean;
  currentWeapon: WeaponId;
  isShooting: boolean;
  setIsShooting: (v: boolean) => void;
}

const keys: Record<string, boolean> = {};

export function FPSControls({
  self, players, onMove, onShoot, onAmmoChange,
  onMuzzleFlash, onHitConfirmed, onWeaponChange, onImpact,
  alive, currentWeapon, isShooting, setIsShooting,
}: Props) {
  const { camera, gl, scene } = useThree();
  const pos = useRef(new THREE.Vector3(self.position.x, PLAYER_HEIGHT, self.position.z));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(self.rotation.y);
  const pitch = useRef(0);
  const isGrounded = useRef(true);
  const lastMoveTime = useRef(0);
  const ammoRef = useRef(WEAPONS[currentWeapon].ammo);
  const reloadingRef = useRef(false);
  const lastShotRef = useRef(0);
  const lockedRef = useRef(false);
  const weaponRef = useRef<WeaponId>(currentWeapon);
  const shootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live refs so event handlers can access R3F state
  const cameraRef = useRef(camera);
  const sceneRef = useRef(scene);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  const onImpactRef = useRef(onImpact);
  useEffect(() => { onImpactRef.current = onImpact; }, [onImpact]);

  useEffect(() => {
    weaponRef.current = currentWeapon;
    ammoRef.current = WEAPONS[currentWeapon].ammo;
    reloadingRef.current = false;
    onAmmoChange(WEAPONS[currentWeapon].ammo, false);
  }, [currentWeapon]);

  useEffect(() => {
    pos.current.set(self.position.x, PLAYER_HEIGHT, self.position.z);
    vel.current.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
  }, [self.position.x, self.position.z]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keys[e.code] = e.type === "keydown";
      if (e.type !== "keydown") return;
      if (e.code === "KeyR" && !reloadingRef.current && ammoRef.current < WEAPONS[weaponRef.current].ammo) {
        startReload();
      }
      if (e.code === "Digit1") onWeaponChange("rifle");
      if (e.code === "Digit2") onWeaponChange("shotgun");
      if (e.code === "Digit3") onWeaponChange("sniper");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!lockedRef.current) return;
      yaw.current -= e.movementX * 0.002;
      pitch.current -= e.movementY * 0.002;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current));
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const onLockChange = () => {
      lockedRef.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener("pointerlockchange", onLockChange);
    const onClick = () => {
      if (!lockedRef.current) gl.domElement.requestPointerLock();
    };
    gl.domElement.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      gl.domElement.removeEventListener("click", onClick);
    };
  }, [gl]);

  const startReload = useCallback(() => {
    reloadingRef.current = true;
    onAmmoChange(0, true);
    setTimeout(() => {
      reloadingRef.current = false;
      ammoRef.current = WEAPONS[weaponRef.current].ammo;
      onAmmoChange(WEAPONS[weaponRef.current].ammo, false);
    }, WEAPONS[weaponRef.current].reloadTime);
  }, [onAmmoChange]);

  // Raycast into scene to find bullet impact point
  const getImpactPoint = useCallback((dir: THREE.Vector3): THREE.Vector3 | null => {
    const rc = new THREE.Raycaster();
    rc.set(cameraRef.current.position, dir.clone().normalize());
    rc.far = 180;
    const hits = rc.intersectObjects(sceneRef.current.children, true);
    for (const hit of hits) {
      // Skip player-tagged objects and very close hits (gun model)
      if (hit.distance < 0.5) continue;
      if (hit.object.userData.noImpact) continue;
      return hit.point.clone();
    }
    // Fallback: project forward 40 units
    return cameraRef.current.position.clone().addScaledVector(dir, 40);
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!lockedRef.current || !alive || e.button !== 0) return;
      const wep = WEAPONS[weaponRef.current];
      const now = Date.now();
      if (now - lastShotRef.current < wep.fireRate) return;
      if (ammoRef.current <= 0 || reloadingRef.current) {
        if (!reloadingRef.current) startReload();
        return;
      }
      lastShotRef.current = now;
      ammoRef.current--;
      onAmmoChange(ammoRef.current, false);
      onMuzzleFlash();
      setIsShooting(true);
      if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
      shootTimerRef.current = setTimeout(() => setIsShooting(false), 80);
      if (ammoRef.current === 0) startReload();

      for (let p = 0; p < wep.pellets; p++) {
        const sx = (Math.random() - 0.5) * wep.spread * 2;
        const sy = (Math.random() - 0.5) * wep.spread * 2;
        const dir = new THREE.Vector3(sx, sy, -1)
          .applyEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"))
          .normalize();

        let closestId: string | null = null;
        let closestDist = 120;

        for (const [id, pl] of players) {
          if (!pl.alive) continue;
          const pPos = new THREE.Vector3(pl.position.x, pl.position.y + 0.75, pl.position.z);
          const dist = pos.current.distanceTo(pPos);
          if (dist < closestDist) {
            const diff = pPos.clone().sub(pos.current).normalize();
            const angle = dir.angleTo(diff);
            const hitRadius = 0.12 + (0.25 / Math.max(dist, 1));
            if (angle < hitRadius) {
              closestDist = dist;
              closestId = id;
            }
          }
        }

        if (closestId) {
          onShoot(closestId, wep.damage);
          onHitConfirmed();
          // Impact on player
          const pl = players.get(closestId);
          if (pl) {
            onImpactRef.current(
              new THREE.Vector3(pl.position.x, pl.position.y + 0.75, pl.position.z),
            );
          }
        } else {
          // Impact on environment — raycast
          const impactPt = getImpactPoint(dir);
          if (impactPt) onImpactRef.current(impactPt);
        }
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [alive, players, onShoot, onMuzzleFlash, onHitConfirmed, onAmmoChange, startReload, setIsShooting, getImpactPoint]);

  useFrame((_, delta) => {
    if (!alive) return;
    const dt = Math.min(delta, 0.05);

    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw.current, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    const move = new THREE.Vector3();
    if (keys["KeyW"]) move.addScaledVector(forward, 1);
    if (keys["KeyS"]) move.addScaledVector(forward, -1);
    if (keys["KeyA"]) move.addScaledVector(right, -1);
    if (keys["KeyD"]) move.addScaledVector(right, 1);
    if (move.lengthSq() > 0) move.normalize();

    const spd = weaponRef.current === "sniper" ? SPEED * 0.8 : SPEED;
    vel.current.x = THREE.MathUtils.lerp(vel.current.x, move.x * spd, 0.18);
    vel.current.z = THREE.MathUtils.lerp(vel.current.z, move.z * spd, 0.18);

    if (keys["Space"] && isGrounded.current) {
      vel.current.y = JUMP_FORCE;
      isGrounded.current = false;
    }
    vel.current.y += GRAVITY * dt;

    pos.current.x += vel.current.x * dt;
    pos.current.z += vel.current.z * dt;
    pos.current.y += vel.current.y * dt;

    if (pos.current.y < PLAYER_HEIGHT) {
      pos.current.y = PLAYER_HEIGHT;
      vel.current.y = 0;
      isGrounded.current = true;
    }
    pos.current.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, pos.current.x));
    pos.current.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, pos.current.z));

    camera.position.copy(pos.current);

    const now = Date.now();
    if (now - lastMoveTime.current > 40) {
      lastMoveTime.current = now;
      onMove(
        { x: pos.current.x, y: pos.current.y - PLAYER_HEIGHT + 0.8, z: pos.current.z },
        { x: pitch.current, y: yaw.current },
      );
    }
  });

  return <FirstPersonGun weaponId={currentWeapon} isShooting={isShooting} />;
}
