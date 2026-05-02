"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryAcquireOptimizerGlobalLock = tryAcquireOptimizerGlobalLock;
exports.releaseOptimizerGlobalLock = releaseOptimizerGlobalLock;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const LOCK_PATH = path.join(os.tmpdir(), 'combine3-optimizer-global.lock.json');
const STALE_MS = 6 * 60 * 60 * 1000;
function isLockHolderProcessAlive(pid) {
    if (!Number.isFinite(pid) || pid < 1)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (err) {
        const e = err;
        if (e.code === 'ESRCH')
            return false;
        if (e.code === 'EPERM')
            return true;
        return false;
    }
}
function readLock() {
    if (!fs.existsSync(LOCK_PATH))
        return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
        if ((parsed.owner === 'timetable' || parsed.owner === 'whatif') &&
            typeof parsed.pid === 'number' &&
            typeof parsed.acquiredAt === 'number') {
            return parsed;
        }
    }
    catch {
    }
    return null;
}
function tryAcquireOptimizerGlobalLock(owner) {
    const now = Date.now();
    const current = readLock();
    if (current) {
        const ageMs = now - current.acquiredAt;
        const lockStale = ageMs > STALE_MS || !isLockHolderProcessAlive(current.pid);
        if (lockStale) {
            try {
                fs.unlinkSync(LOCK_PATH);
            }
            catch {
            }
        }
        else {
            return { ok: false, holder: current.owner };
        }
    }
    const payload = {
        owner,
        pid: process.pid,
        acquiredAt: now,
    };
    try {
        fs.writeFileSync(LOCK_PATH, JSON.stringify(payload), {
            encoding: 'utf8',
            flag: 'wx',
        });
        return { ok: true };
    }
    catch {
        const holder = readLock()?.owner ?? 'timetable';
        return { ok: false, holder };
    }
}
function releaseOptimizerGlobalLock(owner) {
    const current = readLock();
    if (!current)
        return;
    if (current.owner !== owner)
        return;
    try {
        fs.unlinkSync(LOCK_PATH);
    }
    catch {
    }
}
//# sourceMappingURL=optimizer-global-lock.js.map