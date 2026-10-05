"use strict";
const { Pose } = require('./Pose');

const CLONE_VALIDATOR = Symbol('CloneValidator');

/** Named poses moved together, with no geometry of their own.
 * @description
 * PosableGeom2 and PosableGeom3 share this map. Geometry stays on the
 * subclass: a private field can only be read by the class that declares it.
 */
class Posable {
  #poses = Object.create(null);

  /** Empty pose map, then clone each given pose.
   * @description
   * The caller's pose objects are not kept. There is no geometry argument;
   * the subclass stores that itself. Subclass must implement cloneTo(clone, validator)
   * @param {Object<string, Pose>} [poses] Named ports.
   */
  constructor(poses) {
    if (this.constructor === Posable) {
      throw new Error('Cannot instantiate abstract class Poseable directly');
    }
    if (poses) {
      Object.keys(poses).forEach(key => {
        this.#poses[key] = poses[key].clone();
      });
    }
  }

  /** The pose stored at port, or undefined.
   * @description
   * Does not throw. PosableGeom3 overrides this and throws when the port
   * was never set.
   * @param {string|number} port
   * @returns {Pose|undefined}
   */
  getPose(port) {
    const sourcePose = this.#poses[port];
    if (!sourcePose) {
      throw new Error(`Invalid port ${port}`);
    }
    return sourcePose;
  }

  /** Store pose at port.
   * @description
   * Not cloned. The caller and this object share that pose object.
   * @param {string|number} port
   * @param {Pose} pose
   */
  setPose(port, pose) {
    this.#poses[port] = pose;
  }

  /** Transform every named pose by the 4x4.
   * @description
   * Does not touch geometry. Subclasses override, transform their own
   * outline or solid, and call this for the poses.
   * @param {number[]} matrix Column-major 4x4.
   * @returns {Posable} this
   */
  transform(matrix) {
    Object.keys(this.#poses).forEach(key => {
      this.#poses[key].transform(matrix);
    });
    return this;
  }

  /** Transform so the pose at port lands on targetPose.
   * @description
   * One implementation for both geoms. source is this.getPose(port). A
   * missing port throws. targetPose must be a Pose; the instanceof test is
   * parenthesized so a non-Pose is actually rejected. The 4x4 is
   * source.getMatrix(targetPose).
   * @param {string|number} port Must already exist.
   * @param {Pose} targetPose
   * @returns {Posable} this
   * @throws {Error} If port is missing or targetPose is not a Pose.
   */
  alignTo(port, targetPose) {
    const source = this.getPose(port);
    if (!source) {
      throw new Error(`Invalid port ${port}`);
    }
    if (!targetPose || !(targetPose instanceof Pose)) {
      throw new Error(`Invalid targetPose`);
    }
    return this.transform(source.getMatrix(targetPose));
  }
  /** Prototype-linked copy with cloned poses.
   * @description
   * Own property descriptors are copied. #poses is cloned here so that
   * private field is branded Poseable. cloneGeometryOnto then copies the
   * subclass geometry, and it has to run on that class for the same reason.
   * Subclass fields copied by descriptor stay shared unless a subclass clone
   * overwrites them; see Device.
   * @returns {Posable}
   */
  clone() {
    return new Posable(this.#poses);
  }

}

module.exports = { Posable };
