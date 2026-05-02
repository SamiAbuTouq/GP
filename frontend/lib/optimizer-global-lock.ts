import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

type OptimizerOwner = "timetable" | "whatif";

type LockPayload = {
  owner: OptimizerOwner;
  pid: number;
  acquiredAt: number;
};

const LOCK_PATH = path.join(os.tmpdir(), "combine3-optimizer-global.lock.json");
const STALE_MS = 6 * 60 * 60 * 1000;

/** True if a process with this PID is still running on this machine (cross-platform via signal 0). */
function isLockHolderProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ESRCH") return false;
    // No permission to signal the process, but it exists — treat as alive.
    if (e.code === "EPERM") return true;
    return false;
  }
}

function readLock(): LockPayload | null {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as Partial<LockPayload>;
    if (
      (parsed.owner === "timetable" || parsed.owner === "whatif") &&
      typeof parsed.pid === "number" &&
      typeof parsed.acquiredAt === "number"
    ) {
      return parsed as LockPayload;
    }
  } catch {
    /* ignore corrupt lock */
  }
  return null;
}

export function tryAcquireOptimizerGlobalLock(owner: OptimizerOwner): { ok: true } | { ok: false; holder: OptimizerOwner } {
  const now = Date.now();
  const current = readLock();
  if (current) {
    const ageMs = now - current.acquiredAt;
    const lockStale =
      ageMs > STALE_MS || !isLockHolderProcessAlive(current.pid);
    if (lockStale) {
      try {
        unlinkSync(LOCK_PATH);
      } catch {
        /* ignore */
      }
    } else {
      return { ok: false, holder: current.owner };
    }
  }

  const payload: LockPayload = {
    owner,
    pid: process.pid,
    acquiredAt: now,
  };

  try {
    writeFileSync(LOCK_PATH, JSON.stringify(payload), { encoding: "utf8", flag: "wx" });
    return { ok: true };
  } catch {
    const holder = readLock()?.owner ?? "timetable";
    return { ok: false, holder };
  }
}

export function releaseOptimizerGlobalLock(owner: OptimizerOwner): void {
  const current = readLock();
  if (!current) return;
  if (current.owner !== owner) return;
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    /* ignore */
  }
}

export function getOptimizerGlobalLockOwner(): OptimizerOwner | null {
  const current = readLock();
  if (!current) return null;
  const now = Date.now();
  if (now - current.acquiredAt > STALE_MS || !isLockHolderProcessAlive(current.pid)) {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
    return null;
  }
  return current.owner;
}
