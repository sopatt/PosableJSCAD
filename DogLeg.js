"use strict";

const jscad = require('@jscad/modeling');
const { geom3 } = jscad.geometries;
const { mat4 } = jscad.maths;
const { union } = jscad.booleans;
const { Pose } = require('./Pose');
const { PosableGeom3 } = require('./PosableGeom3');
const { Straight } = require('./Straight');
const { Bend } = require('./Bend');

const { cos, sin, acos, atan2, hypot, PI } = Math;

/** Canonical frame: origin, heading +Z, up +Y.
 *
 * @description
 * Pose's constructor defaults are heading +Y and up +Z. Callers
 * that want this frame must pass the axes explicitly.
 *
 * @returns {Pose} origin, heading +Z, up +Y
 */
function canonicalPose() {
  return new Pose([0, 0, 0], [0, 0, 1], [0, 1, 0]);
}

/** Elbow angle and straight run for a dogleg in the YZ plane.
 *
 * @description
 * Two equal bends of angle alpha, then a straight whose length is
 * |end - 2B|. B is one elbow's displacement. Using |end - B| would
 * count a run in the gap the second elbow already closes.
 *
 * @param {number} rBend Bend radius.
 * @param {number} height Forward distance along +Z.
 * @param {number} reach Sideways distance, absolute.
 * @returns {{alpha: number, run: number}}
 *   alpha in (0, pi) and run >= 0. run 0 means the elbows meet.
 */
function solveDogleg(rBend, height, reach) {
  const across = reach - 2 * rBend;
  const scale = hypot(across, height);
  // (reach - 2 r) cos alpha - height sin alpha = -2 r.
  if (!(scale > 0) || 2 * rBend / scale > 1 + 1e-9) {
    throw new Error(
      'DogLeg unreachable: height ' + height +
      ', width ' + reach + ', rBend ' + rBend
    );
  }
  const cosDelta = Math.max(-1, Math.min(1, -2 * rBend / scale));
  const delta = acos(cosDelta);
  const phi = atan2(height, across);
  const candidates = [delta - phi, -delta - phi];
  let best = null;
  // Two roots. Keep the forward elbow with a non-negative run.
  for (const raw of candidates) {
    let alpha = raw;
    while (alpha <= -PI) alpha += 2 * PI;
    while (alpha > PI) alpha -= 2 * PI;
    if (!(alpha > 1e-8 && alpha < PI - 1e-8)) continue;
    const run = (reach - 2 * rBend * (1 - cos(alpha))) / sin(alpha);
    if (!Number.isFinite(run) || run < -1e-6) continue;
    const ahead = 2 * rBend * sin(alpha) + run * cos(alpha);
    if (Math.abs(ahead - height) > 1e-4) continue;
    if (!best || alpha < best.alpha) {
      best = { alpha: alpha, run: run < 1e-8 ? 0 : run };
    }
  }
  if (!best) {
    throw new Error(
      'DogLeg unreachable: height ' + height +
      ', width ' + reach + ', rBend ' + rBend
    );
  }
  return best;
}

/** Canonical dogleg solid, jog toward +Y, before a start pose.
 *
 * @description
 * Bend, optional straight, bend back. The second elbow is rolled a
 * half turn so it sweeps against the first. End heading is +Z.
 *
 * @param {number} rTube Tube radius.
 * @param {number} rBend Bend radius.
 * @param {number} height Forward distance along +Z.
 * @param {number} reach Sideways distance along +Y.
 * @returns {{solid: object, start: Pose, end: Pose, alpha: number,
 *   run: number}}
 */
function buildPositive(rTube, rBend, height, reach) {
  const solved = solveDogleg(rBend, height, reach);
  const alpha = solved.alpha;
  const run = solved.run;
  const bend1 = new Bend(rTube, rBend, alpha);
  const parts = [bend1];
  let tail = bend1.getPose('end');
  if (run > 0) {
    const span = new Straight(rTube, run);
    span.alignTo('start', tail.clone());
    parts.push(span);
    tail = span.getPose('end');
  }
  const bend2 = new Bend(rTube, rBend, alpha);
  // Opposite elbow: half turn so the sweep comes back to +Z.
  bend2.alignTo('start', tail.clone().roll(PI));
  parts.push(bend2);
  return {
    solid: union(parts),
    start: bend1.getPose('start').clone(),
    end: bend2.getPose('end').clone(),
    alpha: alpha,
    run: run
  };
}

/** Circle dogleg in the YZ plane.
 *
 * @description
 * Width is sideways along up (+Y). Height is forward along heading
 * (+Z). End heading stays +Z. A width near 0 is a straight of length
 * height. Built canonical, then alignTo startPose when passed.
 *
 * @param {number} rTube Tube radius.
 * @param {number} rBend Bend radius.
 * @param {number} height Forward distance. Must be > 0.
 * @param {number} width Sideways distance. Negative jogs toward -Y.
 * @param {Pose} [startPose] Defaults to the canonical frame.
 * @returns {PosableGeom3} dogleg with start and end poses
 */
class DogLeg extends PosableGeom3 {
  /** Build the canonical dogleg, then align its start.
   *
   * @param {number} rTube Tube radius.
   * @param {number} rBend Bend radius.
   * @param {number} height Forward distance. Must be > 0.
   * @param {number} width Sideways distance. Negative jogs toward -Y.
   * @param {Pose} [startPose] Defaults to the canonical frame.
   * @returns {PosableGeom3} this
   */
  constructor(rTube, rBend, height, width, startPose) {
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error('DogLeg: height must be a finite number > 0');
    }
    if (!Number.isFinite(width)) {
      throw new Error('DogLeg: width must be a finite number');
    }
    if (!Number.isFinite(rTube) || rTube <= 0) {
      throw new Error('DogLeg: rTube must be a finite number > 0');
    }
    if (!Number.isFinite(rBend) || rBend <= 0) {
      throw new Error('DogLeg: rBend must be a finite number > 0');
    }
    if (rTube >= rBend) {
      throw new Error('DogLeg: rTube must be less than rBend');
    }
    // Near zero sideways: no elbows, just a straight of length height.
    if (Math.abs(width) <= 1e-9 * Math.max(height, rBend, 1)) {
      const tube = new Straight(rTube, height, startPose);
      super(geom3.create(tube.polygons), {
        start: tube.getPose('start'),
        end: tube.getPose('end')
      });
      return;
    }
    const built = buildPositive(rTube, rBend, height, Math.abs(width));
    let solid = built.solid;
    let start = built.start;
    let end = built.end;
    if (width < 0) {
      // Half turn about +Z sends the jog to -Y. Roll the poses back
      // so start up stays +Y. A circle section does not show that roll.
      const half = mat4.fromZRotation(mat4.create(), PI);
      solid = geom3.transform(half, solid);
      start.transform(half).roll(PI);
      end.transform(half).roll(PI);
    }
    super(solid, { start: start, end: end });
    if (startPose) this.alignTo('start', startPose);
  }
}

module.exports = { DogLeg };
