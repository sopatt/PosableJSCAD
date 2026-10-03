"use strict";
const jscad = require('@jscad/modeling');
const { Pose } = require('./Pose');
const { Poseable } = require('./Poseable');
const { mat4, vec2, vec3, vec4 } = jscad.maths;
const { geom2, geom3 } = jscad.geometries;
const { colorize } = jscad.colors;

const [x, y, z, w] = [0, 1, 2, 3];
/** 2D orientation of a 4x4, the way jscad geom2 sees it.
 *
 * @description
 * the determinant of the XY image of the X and Y axes. Negative means the
 * placement mirrors the outline. Kept for that test. The live transform path
 * does not call it.
 *
 * @param {number[]} m Column-major 4x4.
 * @returns {number}
 */
const det2 = (m) => m[0] * m[5] - m[4] * m[1];

/** geom2 plus named Poses.
 *
 * @description
 * Duck-types as geom2 (sides, transforms, color) so the viewer and colorize
 * can hold it.
 *
 * The outline is the cross-section in its own XY. A pose is a port on that
 * outline, not a move of the sides by itself.
 */
class PosableGeom2 extends Poseable {
  #geometry;
  /** Clone the geom2. Poses are cloned by Poseable.
   * @description
   * The caller's geometry is not kept. An empty geom2 is stored if clone
   * fails. Poseable clones each given pose so this object does not keep the
   * caller's pose objects.
   * @param {object} geometry geom2. Empty geom2 if clone fails.
   * @param {Object<string, Pose>} [poses] Named ports.
   */
  constructor(geometry, poses) {
    super(poses);
    this.#geometry = geom2.clone(geometry) || geom2.create();
  }

  /** The geom2 side list.
   *
   * @description
   * This is the live array jscad reads.
   *
   * @returns {object[]}
   */
  get sides() {
    return this.#geometry.sides; 
  }

  /** Replace the side list in place.
   *
   * @param {object[]} value geom2 sides.
   */
  set sides(value) { this.#geometry.sides = value; }

  // Viewer / colorize store color on the inner geom2 — forward it so
  // a PosableGeom2 duck-types correctly.
  get color() { return this.#geometry.color; }

  /** Colorize the inner geom2. null strips color by cloning and deleting it.
   *
   * @description
   * because colorize cannot clear.
   *
   * @param {number[]|null} value RGBA, or null to clear.
   */
  set color(value) {
    if (value == null) {
      const g = geom2.clone(this.#geometry);
      delete g.color;
      this.#geometry = g;
      return;
    }
    this.#geometry = colorize(value, this.#geometry);
  }

  /** The geom2 transform matrix.
   *
   * @description
   * Baking is not done here.
   *
   * @returns {number[]|undefined} mat4, if jscad stored one.
   */
  get transforms() { 
  //  this.#bakeIfNecessary();
    return this.#geometry.transforms; 
  }

  /** Replace the geom2 transform matrix.
   *
   * @param {number[]} value mat4.
   */
  set transforms(value) { this.#geometry.transforms = value; }

  /** Called by Poseable.clone to copy this class's instance veriables onto the clone.
   * @description
   * Internal use only
   * @param {PosableGeom2} clone Shell created by Poseable.clone.
   */
  cloneTo(clone, validator) {
    super.cloneTo(clone, validator); // validates that this method is called by Posable.clone()
    clone.#geometry = geom2.clone(this.#geometry);
  }

  /** Move named poses by a 4x4. Sides stay in local XY.
   * @description
   * geom2.transform bakes through vec2, which has no Z, so a tilt was
   * projected onto the XY plane. The outline stays the cross-section in its
   * own XY. The 4x4 stays on the poses, not on the geom2: toSides would apply
   * a stored matrix with vec2 and flatten it. alignTo, getPose, and extrude
   * place that local outline with the pose. Poses move first, then the geom2.
   * @param {number[]} matrix Column-major 4x4.
   * @returns {PosableGeom2} this
   */
  transform(matrix) {
    super.transform(matrix);
    this.#geometry = geom2.transform(matrix, this.#geometry);
    return this;
  }

  /** 
   * @description Bake the transforms into the geometry so that the stored matrix is applied and reset.
   * Use if you get geometry failing to render transforms. 
   */
  applyTransforms() {
    const geom2 = this.#geometry;
    const m = geom2.transforms;
    if (!m || mat4.isIdentity(m)) return this;

    const sides = geom2.sides;
    for (let i = 0; i < sides.length; i++) {
      const a = sides[i][0]; //a[z] = 0;
      const b = sides[i][1]; //b[z] = 0;
      // vec2.transform writes into the first arg
      vec3.transform(a, a, m);
      vec3.transform(b, b, m);
    }
    geom2.transforms = mat4.create();
    this.#geometry = geom2;
    return this;
  }
}

module.exports = { PosableGeom2 };