"use strict";

const jscad = require('@jscad/modeling');
const { extrudeRotate } = jscad.extrusions;
const { circle } = jscad.primitives;
const { translate } = jscad.transforms;
const { mat4, vec3 } = jscad.maths;
const { geom3 } = jscad.geometries;
const { Pose } = require('./Pose');
const { PosableGeom3 } = require('./PosableGeom3');

const { cos, sin, PI } = Math;

const circleSegments = 32;
const sweepSegments = 48;

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

/** Circular bend of a circle section, sweeping toward +Y.
 *
 * @description
 * Built in the canonical frame, then aligned onto startPose.
 * Positive angle leaves the origin along +Z and bends toward +Y.
 * No profile, cursor, or channels.
 *
 * @param {number} rTube Tube radius.
 * @param {number} rBend Centerline radius.
 * @param {number} angle Sweep in radians, in (0, 2 pi).
 * @param {Pose} [startPose] Defaults to the canonical frame.
 * @returns {PosableGeom3} bend with start and end poses
 */
class Bend extends PosableGeom3 {
  /** Build the bend and align its start.
   *
   * @param {number} rTube Tube radius.
   * @param {number} rBend Centerline radius.
   * @param {number} angle Sweep in radians, in (0, 2 pi).
   * @param {Pose} [startPose] Defaults to the canonical frame.
   * @returns {PosableGeom3} this
   */
  constructor(rTube, rBend, angle, startPose) {
    if (!Number.isFinite(rTube) || rTube <= 0) {
      throw new Error('Bend: rTube must be a finite number > 0');
    }
    if (!Number.isFinite(rBend) || rBend <= 0) {
      throw new Error('Bend: rBend must be a finite number > 0');
    }
    if (rTube >= rBend) {
      throw new Error('Bend: rTube must be less than rBend');
    }
    if (!Number.isFinite(angle) || angle <= 0 || angle >= 2 * PI) {
      throw new Error(
        'Bend: angle must be finite, greater than 0, and less than two pi'
      );
    }
    const section = translate(
      [rBend, 0],
      circle({ radius: rTube, segments: circleSegments })
    );
    // Negative sweep: extrudeRotate's slice reverse mirrors a
    // positive angle. Negating puts the start face on the unmirrored
    // section and sends the tube toward -Y before the turn below.
    let solid = extrudeRotate(
      { angle: -angle, segments: sweepSegments },
      section
    );
    solid = translate([-rBend, 0, 0], solid);
    const axis = vec3.normalize(vec3.create(), [1, -1, 1]);
    // 4 pi / 3 about [1, -1, 1] maps that start to origin / +Z / +Y.
    solid = geom3.transform(
      mat4.fromRotation(mat4.create(), 4 * PI / 3, axis),
      solid
    );
    const start = canonicalPose();
    const end = new Pose(
      [0, rBend * (1 - cos(angle)), rBend * sin(angle)],
      [0, sin(angle), cos(angle)],
      [0, cos(angle), -sin(angle)]
    );
    super(solid, { start: start, end: end });
    if (startPose) this.alignTo('start', startPose);
  }
}

module.exports = { Bend };
