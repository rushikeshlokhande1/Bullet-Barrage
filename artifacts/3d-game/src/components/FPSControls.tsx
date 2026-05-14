import * as THREE from "three";
import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PlayerState } from "../types/game";

const SPEED = 8;
const JUMP_FORCE = 6;
const GRAVITY = -18;
const PLAYER_HEIGHT = 1.7;
const MAX_AMMO = 12;
const RELOAD_TIME = 1500;
const FIRE_COOLDOWN = 180;
const HIT_RANGE = 80;
const HIT_DAMAGE = 25;

interface Props {
  self: PlayerState;
  players: Map<string, PlayerState>;
  onMove: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => void;
  onShoot: (targetId: string, damage: number) => void;
  onAmmoChange: (ammo: number, reloading: boolean) => void;
  onMuzzleFlash: () => void;
  onHitConfirmed: () => void;
  alive: boolean;
}

const keys: Record<string, boolean> = {};

export function FPSControls({
  self,
  players,
  onMove,
  onShoot,
  onAmmoChange,
  onMuzzleFlash,
  onHitConfirmed,
  alive,
}: Props) {
  const { camera, gl } = useThree();
  const pos = useRef(new THREE.Vector3(self.position.x, self.position.y, self.position.z));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(self.rotation.y);
  const pitch = useRef(0);
  const isGrounded = useRef(true);
  const lastMove = useRef(0);
  const ammoRef = useRef(MAX_AMMO);
  const reloadingRef = useRef(false);
  const lastShotRef = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    pos.current.set(self.position.x, PLAYER_HEIGHT, self.position.z);
  }, [self.position.x, self.position.z]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keys[e.code] = e.type === "keydown";
      if (e.code === "KeyR" && e.type === "keydown" && !reloadingRef.current && ammoRef.current < MAX_AMMO) {
        startReload();
      }
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
      if (!locked.current) return;
      yaw.current -= e.movementX * 0.002;
      pitch.current -= e.movementY * 0.002;
      pitch.current = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch.current));
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const onLockChange = () => {
      locked.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener("pointerlockchange", onLockChange);
    const onClick = () => {
      if (!locked.current) {
        gl.domElement.requestPointerLock();
      }
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
      ammoRef.current = MAX_AMMO;
      onAmmoChange(MAX_AMMO, false);
    }, RELOAD_TIME);
  }, [onAmmoChange]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!locked.current || !alive) return;
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - lastShotRef.current < FIRE_COOLDOWN) return;
      if (ammoRef.current <= 0 || reloadingRef.current) {
        if (!reloadingRef.current) startReload();
        return;
      }
      lastShotRef.current = now;
      ammoRef.current--;
      onAmmoChange(ammoRef.current, false);
      onMuzzleFlash();

      if (ammoRef.current === 0) {
        startReload();
      }

      const dir = new THREE.Vector3(0, 0, -1)
        .applyEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"));
      const raycaster = new THREE.Raycaster(pos.current.clone(), dir, 0.1, HIT_RANGE);

      let closestId: string | null = null;
      let closestDist = HIT_RANGE;

      for (const [id, p] of players) {
        if (!p.alive) continue;
        const pPos = new THREE.Vector3(p.position.x, p.position.y + 0.8, p.position.z);
        const dist = pos.current.distanceTo(pPos);
        if (dist < closestDist) {
          const diff = pPos.clone().sub(pos.current);
          const angle = dir.angleTo(diff.normalize());
          if (angle < 0.08) {
            closestDist = dist;
            closestId = id;
          }
        }
      }

      if (closestId) {
        onShoot(closestId, HIT_DAMAGE);
        onHitConfirmed();
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [alive, players, onShoot, onMuzzleFlash, onHitConfirmed, onAmmoChange, startReload]);

  useFrame((_, delta) => {
    if (!alive) return;

    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    const q = new THREE.Quaternion().setFromEuler(euler);
    camera.quaternion.copy(q);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    right.y = 0;
    right.normalize();

    const moveDir = new THREE.Vector3();
    if (keys["KeyW"]) moveDir.addScaledVector(forward, 1);
    if (keys["KeyS"]) moveDir.addScaledVector(forward, -1);
    if (keys["KeyA"]) moveDir.addScaledVector(right, -1);
    if (keys["KeyD"]) moveDir.addScaledVector(right, 1);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    vel.current.x = moveDir.x * SPEED;
    vel.current.z = moveDir.z * SPEED;

    if (keys["Space"] && isGrounded.current) {
      vel.current.y = JUMP_FORCE;
      isGrounded.current = false;
    }

    vel.current.y += GRAVITY * delta;

    pos.current.x += vel.current.x * delta;
    pos.current.z += vel.current.z * delta;
    pos.current.y += vel.current.y * delta;

    const minY = PLAYER_HEIGHT;
    if (pos.current.y < minY) {
      pos.current.y = minY;
      vel.current.y = 0;
      isGrounded.current = true;
    }

    pos.current.x = Math.max(-29, Math.min(29, pos.current.x));
    pos.current.z = Math.max(-29, Math.min(29, pos.current.z));

    camera.position.copy(pos.current);

    const now = Date.now();
    if (now - lastMove.current > 50) {
      lastMove.current = now;
      onMove(
        { x: pos.current.x, y: pos.current.y - PLAYER_HEIGHT + 0.8, z: pos.current.z },
        { x: pitch.current, y: yaw.current },
      );
    }
  });

  return null;
}
