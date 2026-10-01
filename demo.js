"use strict";

const jscad = require('@jscad/modeling');
const { vec3 } = jscad.maths;
const [x, y, z, w] = [0, 1, 2, 3];
const { Pose } = require('./Pose');
const { Straight } = require('./Straight');
const { Bend } = require('./Bend');
const { DogLeg } = require('./DogLeg');

const rTube = 1;

/** Start pose in the canonical frame, shifted on X.
 *
 * @description
 * Heading stays +Z and up stays +Y. The X offset only separates
 * the three tubes so they do not occupy the same space.
 *
 * @param {number} offsetX
 * @returns {Pose}
 */
function frame(offsetX) {
  const point = vec3.fromValues(0, 0, 0);
  const heading = vec3.fromValues(0, 0, 0);
  const up = vec3.fromValues(0, 0, 0);
  point[x] = offsetX;
  heading[z] = 1;
  up[y] = 1;
  return new Pose(point, heading, up);
}

/** RGBA with alpha in the w slot.
 *
 * @description
 * w is the fourth component, matching the library's index order.
 * Alpha is 1, not the index itself.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number[]}
 */
function rgba(r, g, b) {
  const color = [r, g, b, 0];
  color[w] = 1;
  return color;
}

/** Straight, quarter bend, and dogleg, spaced along X.
 *
 * @description
 * Each is a circle tube of radius rTube, built heading +Z and up +Y.
 * Open this file in jscad.app, or call main() from Node.
 *
 * @returns {object[]} three solids
 */
function main() {
  const straight = new Straight(rTube, 10, frame(0));
  const bend = new Bend(rTube, 10, Math.PI / 2, frame(40));
  const dogleg = new DogLeg(rTube, 50, 100, 100, frame(80));
  straight.color = rgba(0.2, 0.55, 0.85);
  bend.color = rgba(0.85, 0.45, 0.15);
  dogleg.color = rgba(0.25, 0.65, 0.35);
  return [straight, bend, dogleg];
}

module.exports = { main };
