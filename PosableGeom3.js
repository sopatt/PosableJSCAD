"use strict";
const jscad = require('@jscad/modeling');
const { mat4 } = jscad.maths;
const { colorize } = jscad.colors;
const { union } = jscad.booleans;
const { geom3 } = jscad.geometries;
const { Pose } = require('./Pose');
const { Poseable } = require('./Posable');
const { PI } = Math;

/** geom3 plus named Poses.
 *
 * @description
 * Duck-types as geom3 (polygons, transforms, color) so the viewer can draw it.
 *
 * A pose is a named port on the solid. 'start' and 'end' are the chain ports
 * used by fromChain.
 */
class PosableGeom3 extends Poseable {
  #geometry;

  /** Clone the geom3. Poses are cloned by Poseable.
   * @description
   * The caller keeps their own objects; this instance does not alias them.
   * An empty geom3 is stored if clone fails.
   * @param {object} geometry geom3. Empty geom3 if clone fails.
   * @param {Object<string, Pose>} [poses] Named ports.
   */
  constructor(geometry, poses) {
    super(poses);
    this.#geometry = geom3.clone(geometry) || geom3.create();
  }

  /** Polygons, after baking a pending transform into them.
   *
   * @description
   * The bake is what makes a moved solid show up where it was moved.
   *
   * @returns {object[]}
   */
  get polygons() { 
    //this.#bakeIfNecessary();
    return this.#geometry.polygons; 
  }

  /** Replace the polygon list.
   *
   * @description
   * Does not bake.
   *
   * @param {object[]} value geom3 polygons.
   */
  set polygons(value) { this.#geometry.polygons = value; }

  /** RGBA on the inner geom3, if set.
   *
   * @returns {number[]|undefined}
   */
  get color() { return this.#geometry.color; }

  /** Colorize the inner geom3. null clones and deletes color, because colorize cannot clear it.
   *
   * @param {number[]|null} value RGBA, or null to clear.
   */
  set color(value) {
    if (value == null) {
      const g = geom3.clone(this.#geometry);
      delete g.color;
      this.#geometry = g;
      return;
    }
    this.#geometry = colorize(value, this.#geometry);
  }

  /** Transform matrix, after baking it into the polygons.
   *
   * @description
   * Reading this does not leave a pending matrix.
   *
   * @returns {number[]} mat4
   */
  get transforms() { 
    //this.#bakeIfNecessary();
    return this.#geometry.transforms; 
  }
  /** Replace the pending transform matrix.
   *
   * @param {number[]} value mat4.
   */
  set transforms(value) { 
    this.#geometry.transforms = value; 
  }

  /** Copy the geom3 onto a Poseable clone. Called by Poseable.clone().
   * @description  Internal use only.
   * @param {PosableGeom3} clone Shell created by Poseable.clone.
   */
  cloneTo(clone, validator) {
    super.cloneTo(clone, validator);
    clone.#geometry = geom3.clone(this.#geometry);
  }

  /** Move the solid and every pose by matrix.
   * @description
   * The geom3 is transformed first, then the poses. That is the order this
   * class already used.
   * @param {number[]} matrix Column-major 4x4.
   * @returns {PosableGeom3} this
   */
  transform(matrix) {
    this.#geometry = geom3.transform(matrix, this.#geometry);
    super.transform(matrix);
    return this;
  }
  /** Lay parts end to end in place.
   *
   * @description
   * Each part's 'start' is aligned to the previous part's 'end'. No copies:
   * clone first if the originals must stay put.
   *
   * One part is just alignTo('start', startPose) of that same object. No union
   * and no wrapper.
   *
   * @param {PosableGeom3[]} chain Each needs a 'start' pose.
   * @param {Pose} startPose Where the first 'start' goes.
   * @returns {PosableGeom3}
   *   The single part, or a union with 'start' at startPose and 'end' at the
   *   last end.
   */
  static fromChain(chain, startPose) {
    if (chain.length === 1) {
      return chain[0].alignTo('start', startPose);
    }
    const result = [];
    let p = startPose;
    for (const g of chain) {
      g.alignTo('start', p);
      result.push(g);
      p = g.getPose('end');
    }
    return new PosableGeom3(
      union(result), 
      {start: startPose, end: p}
    );
  }

  /**
   * @description Bakes stored tranforms into the geometry
   * @returns this
   */
  applyTransforms() {
    const g = this.#geometry;
    const m = g.transforms;
    if (!m || mat4.isIdentity(m)) return this;

    const mirror = mat4.determinant(m) < 0;
    const polys = g.polygons;

    for (let i = 0; i < polys.length; i++) {
      const verts = polys[i].vertices;
      for (let j = 0; j < verts.length; j++) {
        vec3.transform(verts[j], verts[j], m);
      }
      if (mirror) verts.reverse();
      delete polys[i].plane; // stale; next plane() rebuilds
    }

    mat4.identity(m);
    return this;
  }
}

module.exports = { PosableGeom3 };
