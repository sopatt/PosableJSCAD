"use strict";

const { Straight } = require('./Straight');
const { Bend } = require('./Bend');
const { DogLeg } = require('./DogLeg');
const { Pose, rollAround } = require('./Pose');
const { PosableGeom2 } = require('./PosableGeom2');
const { PosableGeom3 } = require('./PosableGeom3');
const { Poseable } = require('./Poseable');
const jscad = require('@jscad/modeling');
const { circle } = jscad.primitives;

const [x, y, z] = [0, 1, 2];

/** Fail the process when a point is not within eps of expected.
 *
 * @description
 * Prints the label, expected point, and actual point, then exits
 * non-zero. A pass returns without printing.
 *
 * @param {number[]} actual
 * @param {number[]} expected
 * @param {number} eps
 * @param {string} label
 */
function assertPoint(actual, expected, eps, label) {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(actual[i] - expected[i]) > eps) {
      console.error(
        label + ' failed: expected [' + expected.join(', ') +
        '] got [' + actual.join(', ') + ']'
      );
      process.exit(1);
    }
  }
}

const straightEnd = new Straight(1, 10).getPose('end').point;
assertPoint(straightEnd, [0, 0, 10], 1e-9, 'Straight(1, 10) end');

const bendEnd = new Bend(1, 10, Math.PI / 2).getPose('end').point;
assertPoint(bendEnd, [0, 10, 10], 1e-6, 'Bend(1, 10, pi/2) end');

const dogEnd = new DogLeg(1, 50, 100, 100).getPose('end').point;
assertPoint(dogEnd, [0, 100, 100], 1e-4, 'DogLeg(1, 50, 100, 100) end');

const pose = new Pose([1, 2, 3], [0, 0, 1], [0, 1, 0]);
const rolled = rollAround([4, 6, 10], pose);
assertPoint(rolled, [1, 7, 10], 1e-9, 'rollAround');

if (straightEnd[z] !== 10 || bendEnd[y] === 0 || dogEnd[y] === 0 || rolled[x] !== 1) {
  console.error('index check failed');
  process.exit(1);
}

const geom2Sample = new PosableGeom2(circle({ radius: 1 }));
const geom3Sample = new PosableGeom3();
if (!(geom2Sample instanceof Poseable) || !(geom3Sample instanceof Poseable)) {
  console.error('instanceof Poseable failed');
  process.exit(1);
}

let missingPose;
try {
  missingPose = geom2Sample.getPose('missing');
} catch (err) {
  console.error('PosableGeom2 getPose threw for a missing port');
  process.exit(1);
}
if (missingPose !== undefined) {
  console.error('PosableGeom2 getPose missing port was not undefined');
  process.exit(1);
}

let geom3Threw = false;
try {
  geom3Sample.getPose('missing');
} catch (err) {
  geom3Threw = err instanceof Error && err.message === 'Invalid port missing';
}
if (!geom3Threw) {
  console.error('PosableGeom3 getPose did not throw for a missing port');
  process.exit(1);
}

const outline = new PosableGeom2(
  circle({ radius: 1 }),
  { start: new Pose([0, 0, 0], [0, 0, 1], [0, 1, 0]) }
);
outline.alignTo('start', new Pose([1, 2, 5], [0, 0, 1], [0, 1, 0]));
assertPoint(
  outline.getPose('start').point,
  [1, 2, 5],
  1e-9,
  'PosableGeom2 alignTo circle start'
);

console.log('pass');
