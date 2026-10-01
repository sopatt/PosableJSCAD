"use strict";

const jscad = require('@jscad/modeling');
const { extrudeLinear } = jscad.extrusions;
const { circle } = jscad.primitives;
const { Pose } = require('./Pose');
const { PosableGeom3 } = require('./PosableGeom3');

const circleSegments = 32;

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

/** Circle tube along +Z.
 *
 * @description
 * Extrude a circle of radius rTube from the origin along +Z, then
 * align the start onto startPose. No profile, cursor, or channels.
 *
 * @param {number} rTube Tube radius.
 * @param {number} length Length along heading.
 * @param {Pose} [startPose] Defaults to the canonical frame.
 * @returns {PosableGeom3} tube with start and end poses
 */
class Straight extends PosableGeom3 {
  /** Build the tube and align its start.
   *
   * @param {number} rTube Tube radius.
   * @param {number} length Length along heading.
   * @param {Pose} [startPose] Defaults to the canonical frame.
   * @returns {PosableGeom3} this
   */
  constructor(rTube, length, startPose) {
    if (!Number.isFinite(rTube) || rTube <= 0) {
      throw new Error(
        'Straight: rTube must be a finite number > 0'
      );
    }
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error(
        'Straight: length must be a finite number > 0'
      );
    }
    const section = circle({
      radius: rTube,
      segments: circleSegments
    });
    const solid = extrudeLinear({ height: length }, section);
    const start = canonicalPose();
    const end = new Pose([0, 0, length], start.heading, start.up);
    super(solid, { start: start, end: end });
    if (startPose) this.alignTo('start', startPose);
  }
}

module.exports = { Straight };
