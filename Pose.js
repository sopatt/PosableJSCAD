"use strict";
const jscad = require('@jscad/modeling');
const { vec3, vec4, mat4 } = jscad.maths;
const { geom3 } = jscad.geometries;
const { abs } = Math;
const { translate } = jscad.transforms;
const { union } = jscad.booleans;
const { cylinder, sphere, cylinderElliptic } = jscad.primitives;

const [x, y, z, w] = [0, 1, 2, 3];

/** Squared distance between two points.
 *
 * @description
 * Used by Pose.equals so a compare does not pay for a square root.
 *
 * @param {number[]} A First point.
 * @param {number[]} B Second point.
 * @returns {number} |A-B|^2.
 */
function squareOfDistance(A, B) {
  const [Ax, Ay, Az] = A;
  const [Bx, By, Bz] = B;
  return (Ax - Bx) ** 2 + (Ay - By) ** 2 + (Az - Bz) ** 2;
}

/** Debug geom3: a sphere at the point, plus an arrow on heading and an arrow on up.
 *
 * @description
 * Each arrow is built along +Z, then rotated onto its vector. Arrow size
 * scales with that vector's length.
 *
 * @param {Pose} pose Frame to draw.
 * @returns {object} geom3
 */
function renderPose(pose) {
  const vecGeom = (vector) => {
    const vectorLength = vec3.length(vector) || 1;
    const vectorRadius = vectorLength / 10;
    const arrowLength = vectorLength / 5;
    const arrowRadius = vectorLength / 5;
    let out = union(
      cylinder({
        center: [0, 0, vectorLength / 2],
        height: vectorLength,
        radius: vectorRadius
      }),
      cylinderElliptic({
        center: [0, 0, vectorLength],
        startRadius: [arrowRadius, arrowRadius],
        endRadius: [0, 0],
        height: arrowLength
      })
    );
    out = geom3.transform(
      mat4.fromVectorRotation(
        mat4.create(),
        [0, 0, vectorLength],
        vector
      ),
      out
    );
    return out;
  };

  return translate(
    pose.point,
    union(
      sphere({ radius: 0.2 }),
      vecGeom(pose.heading),
      vecGeom(pose.up)
    )
  );
}

/** A rigid frame: point, heading, and up.
 *
 * @classdesc
 * Heading is forward. Up is forced into the plane perpendicular to heading,
 * then normalized, so the two stay orthonormal. Right-handed "right" is
 * heading cross up, built by callers.
 *
 * Constructor defaults are origin, heading +Y, up +Z. Profile.canonicalPose is
 * different: heading +Z, up +Y.
 */
class Pose {
  #point;
  #heading;
  #up;
  /** Build a frame.
   *
   * @description
   * Up parallel to heading is replaced: cross with +Z, or with +X if heading is
   * already nearly +Z.
   *
   * @param {number[]} [point] Origin if omitted.
   * @param {number[]} [heading] +Y if omitted. Normalized.
   * @param {number[]} [up] +Z if omitted, then projected.
   */
  constructor(point, heading, up) {
    // Default position to origin if not provided
    point = point ? vec3.clone(point) : [0, 0, 0];
    // Default heading to Y+ (0, 1, 0) if not provided
    heading = vec3.normalize(
      vec3.create(), 
      heading ? vec3.clone(heading) : [0, 1, 0]
    );
    // Default up to Z+ (0, 0, 1) if not provided
    up = up ? vec3.clone(up) : [0, 0, 1];

    // Project up onto the plane perpendicular to heading
    const dot = vec3.dot(up, heading);
    const projectedUp = vec3.subtract(
      vec3.create(),
      up,
      vec3.scale(vec3.create(), heading, dot)
    );
    // Check if up is parallel to heading 
    // (length of projectedUp near zero)
    if (vec3.length(projectedUp) < 1e-6) {
      // Choose a perpendicular vector based on heading
      if (Math.abs(heading[2]) < 0.99999) {
        up = vec3.cross(
          vec3.create(), heading, [0, 0, 1]
        );
      } else {
        up = vec3.cross(
          vec3.create(), heading, [1, 0, 0]
        );
        // Ensure up is normalized
        vec3.normalize(up, up);
      }
    } else {
      up = vec3.normalize(vec3.create(), projectedUp);
    }
    this.#point = point;
    this.#heading = heading;
    this.#up = up;
  }
  /** Copy of the point.
   * @description
   * Mutating the returned array does not move this pose.
   * @returns {number[]} vec3
   */
  get point() {
    return vec3.clone(this.#point);
  }
  /**Copy of the unit heading.
   * @returns {number[]} vec3
   */
  get heading() {
    return vec3.clone(this.#heading);
  }
  /** Copy of the unit up vector, already perpendicular to heading.
   * @returns {number[]} vec3
   */
  get up() {
    return vec3.clone(this.#up);
  }
  /** New Pose with copied point, heading, and up.
   *
   * @returns {Pose}
   */
  clone() {
   return new Pose(
    vec3.clone(this.#point), 
    vec3.clone(this.#heading), 
    vec3.clone(this.#up)
  );
  }
  /** Apply a 4x4 matrix transformation in place.
   * @description
   * Point is transformed as w=1. Heading and up are transformed as w=0
   * (direction only).
   *
   * @param {number[]} matrix Column-major mat4.
   * @returns {Pose} this
   */
  transform(matrix) {
    // Transform point (w = 1)
    let v = this.#point.concat(1); // Convert vec3 to vec4
    v = vec4.transform(vec4.create(), v, matrix);
    this.#point = vec3.clone(v); // Convert back to vec3

    // Transform heading (w = 0)
    v = this.#heading.concat(0); // Convert vec3 to vec4
    v = vec4.transform(vec4.create(), v, matrix);
    this.#heading = vec3.clone(v); // Convert back to vec3

    // Transform up (w = 0)
    v = this.#up.concat(0); // Convert vec3 to vec4
    v = vec4.transform(vec4.create(), v, matrix);
    this.#up = vec3.clone(v); // Convert back to vec3

    return this;
  }
	/** Matrix that carries this pose onto targetPose.
	 *
	 * @description
	 * Translate this point to the origin, rotate heading onto the target heading,
	 * roll about that heading until up matches, then translate to the target
	 * point.
	 *
	 * @param {Pose} targetPose Destination frame.
	 * @returns {number[]} 4x4 column-major matrix.
	 */
	getMatrix(targetPose) {
		let t = mat4.create();

		// Step 1: Translate to origin
		t = mat4.multiply(
			mat4.create(),
			mat4.fromTranslation(mat4.create(), vec3.scale(vec3.create(), this.#point, -1)),
			t
		);

		// Step 2: Align heading with targetPose
		t = mat4.multiply(
			mat4.create(),
			mat4.fromVectorRotation(mat4.create(), this.#heading, targetPose.#heading),
			t
		);

		// Step 3: Roll around heading to align up vector
		const p = this.clone().transform(t);
		const dot = vec3.dot(
			vec3.cross(vec3.create(), p.#up, targetPose.#up),
			p.#heading
		);
		let angle = vec3.angle(p.#up, targetPose.#up);
		if (dot < 0) angle = -angle;

		if (Math.abs(angle) > 1e-6) {
			t = mat4.multiply(
				mat4.create(),
				mat4.fromRotation(mat4.create(), angle, targetPose.#heading),
				t
			);
		}

		// Step 4: Translate to targetPose.point
		t = mat4.multiply(
			mat4.create(),
			mat4.fromTranslation(mat4.create(), targetPose.#point),
			t
		);

		return t;
	}

  /** Sphere at the point, arrow on heading, arrow on up.
   *
   * @returns {object} geom3
   */
  render() {
    return renderPose(this);
  }
  
  /** Roll up around heading, right-handed, in place.
   *
   * @description
   * Point and heading stay put. angle 0 returns this.
   *
   * @param {number} angle Radians about heading.
   * @returns {Pose} this
   */
  roll(angle) {
    if (angle === 0) return this;
    // Create a rotation matrix around the heading vector
    const rotationMatrix = mat4.create();
    mat4.rotate(
    rotationMatrix, rotationMatrix, angle, this.#heading
    );
    // Transform the up vector using the rotation matrix (w = 0)
    const transformedUp = vec4.transform(
      vec4.create(), this.#up.concat(0), rotationMatrix
    );
    this.#up = vec3.clone(transformedUp);

    return this;
  }

  /** Roll about heading so up points at `point` in the plane perpendicular to heading.
   *
   * @description
   * No-op if `point` is on the heading line through this point: there is no
   * unique roll.
   *
   * @param {number[]} point World point to face.
   * @returns {Pose} this
   */
  rollTo(point) {
    // Vector from this pose to the target point.
    const net = vec3.subtract(vec3.create(), point, this.point);

    // Component of that vector along heading (in front / behind the pose).
    const along = vec3.scale(vec3.create(), this.heading, vec3.dot(net, this.heading));

    // Remainder is the sideways offset: in the plane ⟂ heading, toward `point`.
    const side = vec3.subtract(vec3.create(), net, along);

    // On the heading axis: no unique roll; leave up alone.
    if (vec3.length(side) < 1e-12) return this;

    // up = that sideways direction (unit). heading, up, and point are now coplanar,
    // and dot(point - origin, up) > 0.
    vec3.normalize(this.#up, side);
    return this;
  }


  /** Move the point by vector.
   *
   * @description
   * Heading and up are unchanged.
   *
   * @param {number[]} vector vec3 added to the point.
   * @returns {Pose} this
   */
  translate(vector) {
    this.#point = vec3.add(
      vec3.create(),
      vector,
      this.#point
    );
		return this;
  }
  translateOnHeading(distance) {
    const along = vec3.scale(vec3.create(), this.heading, distance);
    return this.translate(along);
  }
  /** True when point, heading, and up each match within 1e-8 squared distance.
   *
   * @description
   * Not a geometric tolerance in meters beyond that.
   *
   * @param {Pose} otherPose
   * @returns {boolean}
   */
  equals(otherPose) {
    return (
      squareOfDistance(this.#point, otherPose.#point) < 1e-8
      && squareOfDistance(this.#heading, otherPose.#heading) < 1e-8
      && squareOfDistance(this.#up, otherPose.#up) < 1e-8
    );
  }

}

/** Roll point around pose.point in the plane orthogonal to pose.heading.
 * @description
 * The component along heading is unchanged, and so is the distance to the
 * heading axis. The part in that plane is turned onto pose.up. A point on
 * the axis is copied. pose is not modified.
 *
 * @param {number[]} point World point.
 * @param {Pose} pose Axis through pose.point, direction pose.heading.
 * @returns {number[]} New point.
 */
function rollAround(point, pose) {
  const origin = pose.point;
  const axis = vec3.normalize(vec3.create(), pose.heading);
  const up = vec3.normalize(vec3.create(), pose.up);
  const net = vec3.subtract(vec3.create(), point, origin);
  const along = vec3.dot(net, axis);
  const parallel = vec3.scale(vec3.create(), axis, along);
  const perp = vec3.subtract(vec3.create(), net, parallel);
  if (vec3.length(perp) < 1e-12) return vec3.clone(point);
  const spun = vec3.scale(vec3.create(), up, vec3.length(perp));
  return vec3.add(
    vec3.create(),
    origin,
    vec3.add(vec3.create(), parallel, spun)
  );
}
module.exports = { Pose, rollAround }; // end of file