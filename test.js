"use strict";

const { Straight } = require('./Straight');
const { Bend } = require('./Bend');
const { DogLeg } = require('./DogLeg');
const { Pose, rollAround } = require('./Pose');

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

console.log('pass');
