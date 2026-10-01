"use strict";
const jscad = require('@jscad/modeling');
const { mat4 } = jscad.maths;
const { colorize } = jscad.colors;
const { union } = jscad.booleans;
const { geom3 } = jscad.geometries;
const { Pose } = require('./Pose');
const { Poseable } = require('./Poseable');
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
  set transforms(value) { this.#geometry.transforms = value; }

  /** Copy the geom3 onto a Poseable clone.
   * @description
   * Poseable.clone copies the pose map, then calls this so #geometry is
   * written by the class that declares it.
   * @param {PosableGeom3} clone Shell created by Poseable.clone.
   */
  cloneGeometryOnto(clone) {
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

  /** If the geom3 still has a non-identity transform, bake polygons and keep color.
   *
   * @description
   * `matrix` is unused. Called from the polygons and transforms getters so a
   * viewer read sees the placed solid.
   *
   * @param {number[]} [matrix] Ignored. Left on the signature.
   */
  #bakeIfNecessary(matrix) { // Sonny added 9/26/2026    
    if (!mat4.isIdentity(this.#geometry.transforms)) {
      const polys = geom3.toPolygons(this.#geometry);
      let fresh = geom3.create(polys);
      if (this.#geometry.color) fresh.color = this.#geometry.color;
      this.#geometry = fresh;
    }
  }

  /** Pose stored at port.
   * @description
   * Throws when the name was never set. The base getPose returns undefined
   * instead, which is the PosableGeom2 contract.
   * @param {string|number} port
   * @returns {Pose}
   * @throws {Error} If that port was never set.
   */
  getPose(port) {
    const sourcePose = super.getPose(port);
    if (!sourcePose) {
      throw new Error(`Invalid port ${port}`);
    }
    return sourcePose;
  }

  /** Store targetPose at port.
   * @description
   * Not cloned. Returns this; the base setPose does not.
   * @param {string|number} port
   * @param {Pose} targetPose
   * @returns {PosableGeom3} this
   */
  setPose(port, targetPose) {
    super.setPose(port, targetPose);
    return this;
  }

  /** Apply transforms to the geometry.
   *
   * @returns
   *   the same object with the transformed geometry; attached poses are updated
   */
  /* Sonny commented out 9/26/2026. Should be eliminated by #bakeIfNecessary
  applyTransforms() {
    // geom3.create(toPolygons(...)) drops .color — keep it.
    const kept = this.#geometry.color;
    this.#geometry = geom3.create(geom3.toPolygons(this.#geometry));
    if (kept) this.#geometry = colorize(kept, this.# geometry);
    return this;
  }*/

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
