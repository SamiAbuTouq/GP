// Unit tests for optimizer global lock behavior in the common module.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  releaseOptimizerGlobalLock,
  tryAcquireOptimizerGlobalLock,
} from './optimizer-global-lock';

const LOCK_PATH = path.join(os.tmpdir(), 'combine3-optimizer-global.lock.json');

describe('optimizer-global-lock', () => {
  afterEach(() => {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  it('first acquire succeeds', () => {
    expect(tryAcquireOptimizerGlobalLock('timetable')).toEqual({ ok: true });
  });

  it('second acquire while first held fails with current holder', () => {
    expect(tryAcquireOptimizerGlobalLock('timetable')).toEqual({ ok: true });
    expect(tryAcquireOptimizerGlobalLock('whatif')).toEqual({
      ok: false,
      holder: 'timetable',
    });
  });

  it('acquire succeeds after release', () => {
    expect(tryAcquireOptimizerGlobalLock('timetable')).toEqual({ ok: true });
    releaseOptimizerGlobalLock('timetable');
    expect(tryAcquireOptimizerGlobalLock('whatif')).toEqual({ ok: true });
  });

  it("releasing a lock you don't own does nothing", () => {
    expect(tryAcquireOptimizerGlobalLock('timetable')).toEqual({ ok: true });
    releaseOptimizerGlobalLock('whatif');
    expect(tryAcquireOptimizerGlobalLock('whatif')).toEqual({
      ok: false,
      holder: 'timetable',
    });
  });
});
