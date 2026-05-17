import * as THREE from "three";
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { FirstPersonGun } from "./FirstPersonGun";
import type { PlayerState, WeaponId } from "../types/game";
import { WEAPON_ORDER, WEAPONS } from "../types/game";
import type { MapBox, MovementPad } from "../data/maps";
import { playReloadCue, playUiWeaponCue, playWeaponFire } from "../lib/weaponAudio";
import type { ImpactMaterial } from "./BulletEffect";

const SPEED = 9;
const JUMP_FORCE = 7;
const GRAVITY = -20;
const AIR_CONTROL = 0.075;
const BHOP_WINDOW = 180;
const BHOP_BONUS = 1.08;
const MAX_GROUND_SPEED = 13.5;
const MAX_AIR_SPEED = 15.5;
const SLIDE_MIN_SPEED = 7.2;
const SLIDE_IMPULSE = 4.6;
const SLIDE_DURATION = 620;
const SLIDE_COOLDOWN = 430;
const MANTLE_MAX_HEIGHT = 1.55;
const MANTLE_FORWARD_CHECK = 1.0;
const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.38;
const MAP_BOUND = 29;
/** How far in front of the camera the muzzle sits — bullets spawn here, not inside walls. */
const MUZZLE_OFFSET = 0.45;

interface Props {
  self: PlayerState;
  players: Map<string, PlayerState>;
  onMove: (pos: { x: number; y: number; z: number }, rot: { x: number; y: number }) => void;
  onShoot: (targetId: string, damage: number) => void;
  onAmmoChange: (ammo: number, reloading: boolean) => void;
  onReloadProgress: (progress: number, label: string) => void;
  onMuzzleFlash: () => void;
  onHitConfirmed: () => void;
  onWeaponChange: (w: WeaponId) => void;
  onAimChange: (aiming: boolean) => void;
  onInspectChange: (inspecting: boolean) => void;
  onMovementState: (state: { label: string; accuracy: number }) => void;
  onProjectileVfx: (event: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    casingPosition: THREE.Vector3;
    casingVelocity: THREE.Vector3;
    weaponId: WeaponId;
    material: ImpactMaterial;
    normal?: THREE.Vector3;
  }) => void;
  alive: boolean;
  currentWeapon: WeaponId;
  isShooting: boolean;
  setIsShooting: (v: boolean) => void;
  boxes: MapBox[];
  movementPads: MovementPad[];
}

interface AABB {
  x0: number; x1: number;
  y0: number; y1: number;
  z0: number; z1: number;
}

interface ImpactResult {
  point: THREE.Vector3;
  normal?: THREE.Vector3;
  material: ImpactMaterial;
}

const keys: Record<string, boolean> = {};
const _tmpDir = new THREE.Vector3();
const _rc = new THREE.Raycaster();
const _cameraTarget = new THREE.Vector3();

function clearInputState() {
  for (const code of Object.keys(keys)) keys[code] = false;
}

export function FPSControls({
  self, players, onMove, onShoot, onAmmoChange,
  onReloadProgress, onMuzzleFlash, onHitConfirmed, onWeaponChange, onAimChange, onInspectChange, onMovementState, onProjectileVfx,
  alive, currentWeapon, isShooting, setIsShooting, boxes, movementPads,
}: Props) {
  const { camera, gl, scene } = useThree();
  const pos = useRef(new THREE.Vector3(self.position.x, PLAYER_HEIGHT, self.position.z));
  const cameraVisualPos = useRef(new THREE.Vector3(self.position.x, PLAYER_HEIGHT, self.position.z));
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
  const fireLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inspectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firingRef = useRef(false);
  const aimingRef = useRef(false);
  const inspectingRef = useRef(false);
  const recoilShotRef = useRef(0);
  const recoilOffsetRef = useRef(new THREE.Vector2());
  const lastMouseRef = useRef(new THREE.Vector2());
  const movementRef = useRef(0);
  const weaponTimeRef = useRef(0);
  const shakeRef = useRef(0);
  const slideTimerRef = useRef(0);
  const slideCooldownRef = useRef(0);
  const lastJumpRef = useRef(0);
  const lastGroundedRef = useRef(Date.now());
  const lastPadRef = useRef<Record<string, number>>({});
  const movementAccuracyRef = useRef(1);
  const movementLabelRef = useRef("GROUNDED");
  const lastMovementReportRef = useRef({ label: "GROUNDED", accuracy: 1, time: 0 });
  const mantleRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number } | null>(null);
  const walkBobRef = useRef(0);
  const wasAliveRef = useRef(alive);

  const cameraRef = useRef(camera);
  const sceneRef = useRef(scene);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  const onProjectileVfxRef = useRef(onProjectileVfx);
  useEffect(() => { onProjectileVfxRef.current = onProjectileVfx; }, [onProjectileVfx]);

  // Precompute AABB extents for solid boxes (skips noCollide entries)
  const collidables = useMemo<AABB[]>(() =>
    boxes
      .filter((b) => !b.noCollide)
      .map((b) => ({
        x0: b.pos[0] - b.size[0] / 2,
        x1: b.pos[0] + b.size[0] / 2,
        y0: b.pos[1] - b.size[1] / 2,
        y1: b.pos[1] + b.size[1] / 2,
        z0: b.pos[2] - b.size[2] / 2,
        z1: b.pos[2] + b.size[2] / 2,
      })),
    [boxes],
  );

  useEffect(() => {
    weaponRef.current = currentWeapon;
    ammoRef.current = WEAPONS[currentWeapon].ammo;
    reloadingRef.current = false;
    recoilShotRef.current = 0;
    aimingRef.current = false;
    inspectingRef.current = false;
    onAimChange(false);
    onInspectChange(false);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    if (reloadProgressRef.current) clearInterval(reloadProgressRef.current);
    onAmmoChange(WEAPONS[currentWeapon].ammo, false);
    onReloadProgress(0, "");
  }, [currentWeapon, onAimChange, onInspectChange, onAmmoChange, onReloadProgress]);

  useEffect(() => {
    const serverPos = new THREE.Vector3(self.position.x, PLAYER_HEIGHT, self.position.z);
    const wasAlive = wasAliveRef.current;
    const teleported = pos.current.distanceTo(serverPos) > 3.0;
    wasAliveRef.current = alive;

    if (!alive || (!wasAlive && alive) || teleported) {
      pos.current.copy(serverPos);
      cameraVisualPos.current.copy(serverPos);
      vel.current.set(0, 0, 0);
      mantleRef.current = null;
      slideTimerRef.current = 0;
      isGrounded.current = true;
      clearInputState();
    }
  }, [alive, self.position.x, self.position.z]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keys[e.code] = e.type === "keydown";
      if (e.type !== "keydown" || e.repeat) return;
      if (e.code === "KeyR" && !reloadingRef.current && ammoRef.current < WEAPONS[weaponRef.current].ammo) {
        startReload();
      }
      if (e.code === "KeyF" && !reloadingRef.current && !inspectingRef.current) {
        const wep = WEAPONS[weaponRef.current];
        inspectingRef.current = true;
        onInspectChange(true);
        playUiWeaponCue("inspect");
        if (inspectTimerRef.current) clearTimeout(inspectTimerRef.current);
        inspectTimerRef.current = setTimeout(() => {
          inspectingRef.current = false;
          onInspectChange(false);
        }, wep.inspectTime);
      }
      const digit = Number(e.code.replace("Digit", ""));
      const nextWeapon = WEAPON_ORDER[digit - 1];
      if (nextWeapon) onWeaponChange(nextWeapon);
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
      const sensitivity = aimingRef.current ? 0.00125 : 0.002;
      yaw.current -= e.movementX * sensitivity;
      pitch.current -= e.movementY * sensitivity;
      lastMouseRef.current.set(e.movementX, e.movementY);
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current));
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const onLockChange = () => {
      lockedRef.current = document.pointerLockElement === gl.domElement;
      if (!lockedRef.current) {
        clearInputState();
        firingRef.current = false;
        if (fireLoopRef.current) clearTimeout(fireLoopRef.current);
        setIsShooting(false);
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    const onClick = () => {
      if (!lockedRef.current) {
        const lockRequest = gl.domElement.requestPointerLock();
        if (lockRequest) lockRequest.catch(() => {});
      }
    };
    gl.domElement.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      gl.domElement.removeEventListener("click", onClick);
    };
  }, [gl]);

  useEffect(() => {
    const onBlur = () => clearInputState();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") clearInputState();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const startReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    if (reloadProgressRef.current) clearInterval(reloadProgressRef.current);
    const weaponAtStart = weaponRef.current;
    const wep = WEAPONS[weaponAtStart];
    const startedAt = Date.now();
    let lastStage = -1;
    reloadingRef.current = true;
    firingRef.current = false;
    setIsShooting(false);
    onAmmoChange(0, true);
    onReloadProgress(0, wep.reloadStages[0]?.label ?? "RELOADING");
    reloadProgressRef.current = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / wep.reloadTime, 1);
      const stageIndex = Math.max(0, wep.reloadStages.findLastIndex((stage) => progress >= stage.at));
      const stage = wep.reloadStages[stageIndex] ?? wep.reloadStages[0];
      if (stageIndex !== lastStage) {
        lastStage = stageIndex;
        playReloadCue(stageIndex);
      }
      onReloadProgress(progress, stage?.label ?? "RELOADING");
    }, 45);
    reloadTimerRef.current = setTimeout(() => {
      if (reloadProgressRef.current) clearInterval(reloadProgressRef.current);
      reloadingRef.current = false;
      ammoRef.current = WEAPONS[weaponAtStart].ammo;
      onAmmoChange(WEAPONS[weaponAtStart].ammo, false);
      onReloadProgress(0, "");
      playReloadCue(2);
    }, wep.reloadTime);
  }, [onAmmoChange, onReloadProgress, setIsShooting]);

  /**
   * Raycast from just past the muzzle toward a target to check if a solid
   * map box (userData.mapBox === true) blocks the line of sight.
   * Player meshes (userData.isPlayer) are transparently ignored.
   */
  const hasLineOfSight = useCallback((
    shooterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
  ): boolean => {
    const dist = shooterPos.distanceTo(targetPos);
    if (dist < 1.5) return true; // point-blank — always registers
    _tmpDir.subVectors(targetPos, shooterPos).normalize();
    // Start MUZZLE_OFFSET past the shooter so we never hit the wall we're pressed against
    const origin = shooterPos.clone().addScaledVector(_tmpDir, MUZZLE_OFFSET);
    _rc.set(origin, _tmpDir);
    _rc.far = Math.max(0.1, dist - 0.4); // stop just before the target hitbox
    const hits = _rc.intersectObjects(sceneRef.current.children, true);
    for (const hit of hits) {
      // A solid map wall is in the way — shot blocked
      if (hit.object.userData.mapBox) return false;
    }
    return true;
  }, []);

  /**
   * Raycast into the scene from the muzzle to find where a bullet lands.
   * Starts MUZZLE_OFFSET ahead so it can never immediately re-hit the surface
   * the player is pressed against.
   */
  const getImpactPoint = useCallback((dir: THREE.Vector3): ImpactResult => {
    const normDir = dir.clone().normalize();
    const origin = cameraRef.current.position.clone().addScaledVector(normDir, MUZZLE_OFFSET);
    _rc.set(origin, normDir);
    _rc.far = 180;
    const hits = _rc.intersectObjects(sceneRef.current.children, true);
    for (const hit of hits) {
      if (hit.object.userData.noImpact) continue;
      if (hit.object.userData.isPlayer) continue; // don't use player mesh as impact surface
      const normal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
      return {
        point: hit.point.clone(),
        normal,
        material: (hit.object.userData.impactMaterial as ImpactMaterial | undefined) ?? "concrete",
      };
    }
    return { point: origin.addScaledVector(normDir, 40), material: "concrete" };
  }, []);

  const horizontalSpeed = useCallback(() => Math.hypot(vel.current.x, vel.current.z), []);

  const clampHorizontalSpeed = useCallback((maxSpeed: number) => {
    const speed = horizontalSpeed();
    if (speed <= maxSpeed || speed <= 0.001) return;
    const scale = maxSpeed / speed;
    vel.current.x *= scale;
    vel.current.z *= scale;
  }, [horizontalSpeed]);

  const reportMovementState = useCallback((label: string, accuracy: number, force = false) => {
    const now = performance.now();
    const last = lastMovementReportRef.current;
    if (
      !force &&
      label === last.label &&
      Math.abs(accuracy - last.accuracy) < 0.04 &&
      now - last.time < 140
    ) {
      return;
    }

    lastMovementReportRef.current = { label, accuracy, time: now };
    onMovementState({ label, accuracy });
  }, [onMovementState]);

  const tryMantle = useCallback((forward: THREE.Vector3) => {
    if (isGrounded.current) return false;
    const probe = pos.current.clone().addScaledVector(forward, MANTLE_FORWARD_CHECK);
    for (const b of collidables) {
      const nearX = probe.x + PLAYER_RADIUS > b.x0 && probe.x - PLAYER_RADIUS < b.x1;
      const nearZ = probe.z + PLAYER_RADIUS > b.z0 && probe.z - PLAYER_RADIUS < b.z1;
      if (!nearX || !nearZ) continue;
      const feet = pos.current.y - PLAYER_HEIGHT;
      const climbHeight = b.y1 - feet;
      if (climbHeight <= 0.15 || climbHeight > MANTLE_MAX_HEIGHT) continue;
      const target = new THREE.Vector3(
        THREE.MathUtils.clamp(probe.x + forward.x * 0.55, b.x0 + PLAYER_RADIUS, b.x1 - PLAYER_RADIUS),
        b.y1 + PLAYER_HEIGHT + 0.04,
        THREE.MathUtils.clamp(probe.z + forward.z * 0.55, b.z0 + PLAYER_RADIUS, b.z1 - PLAYER_RADIUS),
      );
      mantleRef.current = { from: pos.current.clone(), to: target, elapsed: 0, duration: 0.24 };
      vel.current.set(0, 0, 0);
      isGrounded.current = false;
      movementLabelRef.current = climbHeight > 0.9 ? "MANTLE" : "VAULT";
      return true;
    }
    return false;
  }, [collidables]);

  const fireShot = useCallback(() => {
    if (!lockedRef.current || !alive || inspectingRef.current) return false;
      const wep = WEAPONS[weaponRef.current];
      const now = Date.now();
    if (now - lastShotRef.current < wep.fireRate) return false;
      if (ammoRef.current <= 0 || reloadingRef.current) {
      if (!reloadingRef.current) {
        playUiWeaponCue("empty");
        startReload();
      }
      return false;
    }
      lastShotRef.current = now;
      ammoRef.current--;
      onAmmoChange(ammoRef.current, false);
      onMuzzleFlash();
    playWeaponFire(wep, aimingRef.current);
      setIsShooting(true);
      if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
      shootTimerRef.current = setTimeout(() => setIsShooting(false), 80);

    const pattern = wep.recoilPattern[recoilShotRef.current % wep.recoilPattern.length] ?? [0, 1];
    const aimMul = aimingRef.current ? 0.58 : 1;
    recoilOffsetRef.current.x += wep.recoilKick * pattern[1] * aimMul;
    recoilOffsetRef.current.y += wep.recoilKick * pattern[0] * 0.55 * aimMul;
    shakeRef.current = Math.min(1, shakeRef.current + wep.recoilKick * (weaponRef.current === "shell_lobber" ? 12 : 4.5));
    recoilShotRef.current++;

      for (let p = 0; p < wep.pellets; p++) {
      const movementPenalty = 1 + (1 - movementAccuracyRef.current) * (aimingRef.current ? 0.85 : 1.75);
      const spread = wep.spread * (aimingRef.current ? wep.adsSpreadMultiplier : 1) * movementPenalty;
        const sx = (Math.random() - 0.5) * spread * 2;
        const sy = (Math.random() - 0.5) * spread * 2;
        const dir = new THREE.Vector3(sx, sy, -1)
        .applyEuler(new THREE.Euler(
          pitch.current + recoilOffsetRef.current.x,
          yaw.current + recoilOffsetRef.current.y,
          0,
          "YXZ",
        ))
          .normalize();

        // Muzzle world position — start of the bullet trace
        const muzzlePos = pos.current.clone().addScaledVector(dir, MUZZLE_OFFSET);
        const casingPosition = cameraRef.current.position.clone()
          .add(new THREE.Vector3(0.22, -0.18, -0.16).applyQuaternion(cameraRef.current.quaternion));
        const casingVelocity = new THREE.Vector3(
          1.4 + Math.random() * 0.8,
          1.0 + Math.random() * 0.6,
          0.2 - Math.random() * 0.4,
        ).applyQuaternion(cameraRef.current.quaternion);
        const emitVfx = (impact: ImpactResult) => {
          onProjectileVfxRef.current({
            start: muzzlePos,
            end: impact.point,
            normal: impact.normal,
            material: impact.material,
            casingPosition,
            casingVelocity,
            weaponId: weaponRef.current,
          });
          if (weaponRef.current === "shell_lobber") {
            const blastDist = impact.point.distanceTo(pos.current);
            if (blastDist < 6.5) {
              const away = pos.current.clone().sub(impact.point).setY(0).normalize();
              const strength = (1 - blastDist / 6.5) * 8.5;
              vel.current.addScaledVector(away, strength);
              vel.current.y = Math.max(vel.current.y, strength * 0.45);
              shakeRef.current = Math.min(1.4, shakeRef.current + (1 - blastDist / 6.5) * 0.9);
            }
          }
        };

        // ── Player hit detection (angle check + LOS validation) ────────────
        let closestId: string | null = null;
        let closestDist = 120;
        let closestTargetPos: THREE.Vector3 | null = null;

        for (const [id, pl] of players) {
          if (!pl.alive) continue;
          const tPos = new THREE.Vector3(pl.position.x, pl.position.y + 0.75, pl.position.z);
          const dist = muzzlePos.distanceTo(tPos);
          if (dist >= closestDist) continue;

          const diff = tPos.clone().sub(muzzlePos).normalize();
          const angle = dir.angleTo(diff);
          const hitRadius = 0.12 + (0.28 / Math.max(dist, 1));
          if (angle < hitRadius) {
            closestDist = dist;
            closestId = id;
            closestTargetPos = tPos;
          }
        }

        if (closestId && closestTargetPos) {
          // LOS check — don't register hit if a solid wall is between muzzle and target
          if (hasLineOfSight(muzzlePos, closestTargetPos)) {
            onShoot(closestId, wep.damage);
            onHitConfirmed();
            emitVfx({ point: closestTargetPos, material: "flesh" });
          } else {
            // Shot stopped by cover — show impact on the wall
            emitVfx(getImpactPoint(dir));
          }
        } else {
          // No player in sights — impact on environment
          emitVfx(getImpactPoint(dir));
        }
      }
    if (ammoRef.current === 0) startReload();
    return true;
  }, [alive, players, onShoot, onMuzzleFlash, onHitConfirmed, onAmmoChange, startReload,
      setIsShooting, getImpactPoint, hasLineOfSight]);

  const scheduleNextShot = useCallback(() => {
    if (fireLoopRef.current) clearTimeout(fireLoopRef.current);
    const wep = WEAPONS[weaponRef.current];
    if (!firingRef.current || wep.fireMode !== "auto") return;
    fireLoopRef.current = setTimeout(() => {
      if (!firingRef.current) return;
      fireShot();
      scheduleNextShot();
    }, wep.fireRate);
  }, [fireShot]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!lockedRef.current || !alive) return;
      if (e.button === 2) {
        aimingRef.current = true;
        onAimChange(true);
        playUiWeaponCue("ads");
        return;
      }
      if (e.button !== 0) return;
      firingRef.current = true;
      const fired = fireShot();
      if (fired) {
        const wep = WEAPONS[weaponRef.current];
        if (wep.fireMode === "auto") scheduleNextShot();
        if (wep.fireMode === "burst") {
          fireLoopRef.current = setTimeout(() => {
            fireShot();
            fireLoopRef.current = setTimeout(() => fireShot(), wep.fireRate);
          }, wep.fireRate);
        }
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        aimingRef.current = false;
        onAimChange(false);
      }
      if (e.button === 0) {
        firingRef.current = false;
        if (fireLoopRef.current) clearTimeout(fireLoopRef.current);
      }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [alive, fireShot, scheduleNextShot, onAimChange]);

  useEffect(() => () => {
    if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
    if (fireLoopRef.current) clearTimeout(fireLoopRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    if (reloadProgressRef.current) clearInterval(reloadProgressRef.current);
    if (inspectTimerRef.current) clearTimeout(inspectTimerRef.current);
  }, []);

  useFrame((_, delta) => {
    if (!alive) return;
    const dt = Math.min(delta, 0.05);
    const wep = WEAPONS[weaponRef.current];
    weaponTimeRef.current += dt;
    slideTimerRef.current = Math.max(0, slideTimerRef.current - dt * 1000);
    slideCooldownRef.current = Math.max(0, slideCooldownRef.current - dt * 1000);
    recoilOffsetRef.current.multiplyScalar(Math.max(0, 1 - dt * wep.recoilRecovery));
    lastMouseRef.current.multiplyScalar(Math.max(0, 1 - dt * 10));
    recoilShotRef.current = Math.max(0, recoilShotRef.current - dt * 2.2);

    const viewPitch = pitch.current + recoilOffsetRef.current.x;
    const viewYaw = yaw.current + recoilOffsetRef.current.y;
    const euler = new THREE.Euler(viewPitch, viewYaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
    if ("fov" in camera) {
      const perspective = camera as THREE.PerspectiveCamera;
      const targetFov = aimingRef.current ? wep.adsFov : 80;
      perspective.fov = THREE.MathUtils.lerp(perspective.fov, targetFov, 1 - Math.exp(-dt * 12));
      perspective.updateProjectionMatrix();
    }

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw.current, 0));
    const right   = new THREE.Vector3(1, 0,  0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    if (mantleRef.current) {
      const mantle = mantleRef.current;
      mantle.elapsed += dt;
      const t = Math.min(mantle.elapsed / mantle.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      pos.current.lerpVectors(mantle.from, mantle.to, eased);
      cameraVisualPos.current.copy(pos.current);
      camera.position.copy(cameraVisualPos.current);
      if (t >= 1) {
        mantleRef.current = null;
        isGrounded.current = true;
        lastGroundedRef.current = Date.now();
      }
      onMove(
        { x: pos.current.x, y: pos.current.y - PLAYER_HEIGHT + 0.8, z: pos.current.z },
        { x: pitch.current, y: yaw.current },
      );
      movementRef.current = 0.2;
      movementAccuracyRef.current = 0.7;
      reportMovementState(movementLabelRef.current, movementAccuracyRef.current, true);
      return;
    }

    const move = new THREE.Vector3();
    if (keys["KeyW"]) move.addScaledVector(forward, 1);
    if (keys["KeyS"]) move.addScaledVector(forward, -1);
    if (keys["KeyA"]) move.addScaledVector(right, -1);
    if (keys["KeyD"]) move.addScaledVector(right, 1);
    if (move.lengthSq() > 0) move.normalize();
    movementRef.current = move.lengthSq();

    const weaponSpeed = weaponRef.current === "yolkpiercer" || weaponRef.current === "rapid_yolker"
      ? SPEED * 0.8
      : SPEED;
    const spd = aimingRef.current ? weaponSpeed * wep.adsSpeedMultiplier : weaponSpeed;
    const wantsSlide = (keys["ShiftLeft"] || keys["ShiftRight"] || keys["ControlLeft"] || keys["ControlRight"]) && move.lengthSq() > 0;
    if (wantsSlide && isGrounded.current && slideTimerRef.current <= 0 && slideCooldownRef.current <= 0 && horizontalSpeed() > SLIDE_MIN_SPEED) {
      slideTimerRef.current = SLIDE_DURATION;
      slideCooldownRef.current = SLIDE_DURATION + SLIDE_COOLDOWN;
      const slideDir = new THREE.Vector3(vel.current.x, 0, vel.current.z).normalize();
      vel.current.x += slideDir.x * SLIDE_IMPULSE;
      vel.current.z += slideDir.z * SLIDE_IMPULSE;
      movementLabelRef.current = "SLIDE";
    }

    if (slideTimerRef.current > 0) {
      const slideAccel = 1 - Math.exp(-dt * 2.8);
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, move.x * spd * 1.15, slideAccel);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, move.z * spd * 1.15, slideAccel);
      vel.current.multiplyScalar(1 - dt * 0.8);
      clampHorizontalSpeed(MAX_AIR_SPEED);
    } else if (isGrounded.current) {
      const groundAccel = 1 - Math.exp(-dt * 13.0);
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, move.x * spd, groundAccel);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, move.z * spd, groundAccel);
      clampHorizontalSpeed(MAX_GROUND_SPEED);
    } else {
      vel.current.x += move.x * spd * AIR_CONTROL * dt * 10;
      vel.current.z += move.z * spd * AIR_CONTROL * dt * 10;
      clampHorizontalSpeed(MAX_AIR_SPEED);
    }

    if (keys["Space"] && isGrounded.current) {
      const now = Date.now();
      const bhop = now - lastJumpRef.current < BHOP_WINDOW && horizontalSpeed() > SPEED * 0.75;
      vel.current.y = JUMP_FORCE * (bhop ? 1.04 : 1);
      if (bhop) {
        vel.current.x *= BHOP_BONUS;
        vel.current.z *= BHOP_BONUS;
      }
      lastJumpRef.current = now;
      isGrounded.current = false;
      movementLabelRef.current = bhop ? "BHOP" : "JUMP";
    } else if (keys["Space"] && !isGrounded.current && vel.current.y < 1.2) {
      tryMantle(forward);
    }
    vel.current.y += GRAVITY * dt;

    // ── Axis-separated movement + AABB solid box collision ───────────────

    // X axis
    pos.current.x += vel.current.x * dt;
    for (const b of collidables) {
      const px0 = pos.current.x - PLAYER_RADIUS, px1 = pos.current.x + PLAYER_RADIUS;
      const py0 = pos.current.y - PLAYER_HEIGHT, py1 = pos.current.y;
      const pz0 = pos.current.z - PLAYER_RADIUS, pz1 = pos.current.z + PLAYER_RADIUS;
      if (px1 > b.x0 && px0 < b.x1 && py1 > b.y0 && py0 < b.y1 && pz1 > b.z0 && pz0 < b.z1) {
        pos.current.x = vel.current.x > 0 ? b.x0 - PLAYER_RADIUS : b.x1 + PLAYER_RADIUS;
        vel.current.x = 0;
      }
    }
    pos.current.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, pos.current.x));

    // Z axis
    pos.current.z += vel.current.z * dt;
    for (const b of collidables) {
      const px0 = pos.current.x - PLAYER_RADIUS, px1 = pos.current.x + PLAYER_RADIUS;
      const py0 = pos.current.y - PLAYER_HEIGHT, py1 = pos.current.y;
      const pz0 = pos.current.z - PLAYER_RADIUS, pz1 = pos.current.z + PLAYER_RADIUS;
      if (px1 > b.x0 && px0 < b.x1 && py1 > b.y0 && py0 < b.y1 && pz1 > b.z0 && pz0 < b.z1) {
        pos.current.z = vel.current.z > 0 ? b.z0 - PLAYER_RADIUS : b.z1 + PLAYER_RADIUS;
        vel.current.z = 0;
      }
    }
    pos.current.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, pos.current.z));

    // Y axis (gravity, floor, box tops / undersides)
    pos.current.y += vel.current.y * dt;

    if (pos.current.y < PLAYER_HEIGHT) {
      pos.current.y = PLAYER_HEIGHT;
      vel.current.y = 0;
      isGrounded.current = true;
      lastGroundedRef.current = Date.now();
    }

    for (const b of collidables) {
      const px0 = pos.current.x - PLAYER_RADIUS, px1 = pos.current.x + PLAYER_RADIUS;
      const pz0 = pos.current.z - PLAYER_RADIUS, pz1 = pos.current.z + PLAYER_RADIUS;
      if (px1 <= b.x0 || px0 >= b.x1 || pz1 <= b.z0 || pz0 >= b.z1) continue;

      const feet = pos.current.y - PLAYER_HEIGHT;
      const head = pos.current.y;

      if (vel.current.y <= 0 && feet < b.y1 && feet >= b.y0 - 0.05) {
        pos.current.y = b.y1 + PLAYER_HEIGHT;
        vel.current.y = 0;
        isGrounded.current = true;
        lastGroundedRef.current = Date.now();
      } else if (vel.current.y > 0 && head > b.y0 && head <= b.y1 + 0.05) {
        pos.current.y = b.y0;
        vel.current.y = 0;
      }
    }

    const nowMs = Date.now();
    for (const pad of movementPads) {
      const dx = pos.current.x - pad.pos[0];
      const dz = pos.current.z - pad.pos[2];
      const dy = Math.abs((pos.current.y - PLAYER_HEIGHT) - pad.pos[1]);
      if ((dx * dx + dz * dz) > pad.radius * pad.radius || dy > 1.0) continue;
      if (nowMs - (lastPadRef.current[pad.id] ?? 0) < 650) continue;
      lastPadRef.current[pad.id] = nowMs;
      vel.current.set(pad.impulse[0], pad.impulse[1], pad.impulse[2]);
      isGrounded.current = false;
      slideTimerRef.current = 0;
      shakeRef.current = Math.min(0.8, shakeRef.current + (pad.type === "launch" ? 0.38 : 0.22));
      movementLabelRef.current = pad.type === "launch" ? "LAUNCH" : "JUMP PAD";
    }

    const horizontal = horizontalSpeed();
    const movingOnGround = isGrounded.current && move.lengthSq() > 0.001 && slideTimerRef.current <= 0;
    const bobSpeed = 7.5 + THREE.MathUtils.clamp(horizontal / SPEED, 0, 1.6) * 5.0;
    walkBobRef.current += dt * bobSpeed;
    const walkBob = movingOnGround
      ? Math.sin(walkBobRef.current) * 0.018 + Math.sin(walkBobRef.current * 2) * 0.006
      : 0;
    const cameraBob = slideTimerRef.current > 0 ? -0.42 : walkBob;
    _cameraTarget.copy(pos.current).y += cameraBob;
    cameraVisualPos.current.lerp(_cameraTarget, 1 - Math.exp(-dt * 30));
    camera.position.copy(cameraVisualPos.current);
    if (shakeRef.current > 0.001) {
      const trauma = shakeRef.current * shakeRef.current;
      const shakeTime = weaponTimeRef.current * 52;
      camera.position.x += Math.sin(shakeTime * 1.7) * trauma * 0.035;
      camera.position.y += Math.cos(shakeTime * 2.1) * trauma * 0.025;
      camera.rotateZ(Math.sin(shakeTime * 1.35) * trauma * 0.009);
      shakeRef.current = Math.max(0, shakeRef.current - dt * 2.7);
    }

    const now = Date.now();
    const speed01 = THREE.MathUtils.clamp(horizontalSpeed() / MAX_AIR_SPEED, 0, 1);
    const airbornePenalty = isGrounded.current ? 0 : 0.18;
    const slidePenalty = slideTimerRef.current > 0 ? 0.18 : 0;
    const aimBonus = aimingRef.current ? 0.16 : 0;
    const label = mantleRef.current
      ? movementLabelRef.current
      : slideTimerRef.current > 0
        ? "SLIDE"
        : !isGrounded.current
          ? movementLabelRef.current === "LAUNCH" || movementLabelRef.current === "JUMP PAD" ? movementLabelRef.current : "AIR"
          : speed01 > 0.72
            ? "SPRINT"
            : speed01 > 0.2
              ? "MOVE"
              : "GROUNDED";
    movementLabelRef.current = label;
    movementAccuracyRef.current = THREE.MathUtils.clamp(1 - speed01 * 0.32 - airbornePenalty - slidePenalty + aimBonus, 0.35, 1);
    reportMovementState(label, movementAccuracyRef.current);
    if (now - lastMoveTime.current > 40) {
      lastMoveTime.current = now;
      onMove(
        { x: pos.current.x, y: pos.current.y - PLAYER_HEIGHT + 0.8, z: pos.current.z },
        { x: pitch.current, y: yaw.current },
      );
    }
  });

  return (
    <FirstPersonGun
      weaponId={currentWeapon}
      isShooting={isShooting}
      isAiming={aimingRef.current}
      isReloading={reloadingRef.current}
      isInspecting={inspectingRef.current}
      movementRef={movementRef}
      lookRef={lastMouseRef}
    />
  );
}
