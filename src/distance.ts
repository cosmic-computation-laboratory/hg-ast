import { FloatSym, index, Vec2Sym, Vec3Sym } from "@thi.ng/shader-ast";
import {
  float,
  FLOAT0,
  FLOAT05,
  FLOAT1,
  FLOAT2,
  int,
  PHI,
  PI,
  vec2,
  VEC2_0,
  vec3,
  VEC3_0,
  VEC3_1,
} from "@thi.ng/shader-ast/ast/lit";
import { defn, ret } from "@thi.ng/shader-ast/ast/function";
import {
  add,
  and,
  div,
  gt,
  inc,
  lt,
  lte,
  mul,
  neg,
  reciprocal,
  sub,
} from "@thi.ng/shader-ast/ast/ops";
import { arraySym, sym } from "@thi.ng/shader-ast/ast/sym";
import {
  abs,
  cos,
  dot,
  length,
  max,
  min,
  mix,
  normalize,
  pow,
  sqrt,
  step,
} from "@thi.ng/shader-ast/builtin/math";
import { $x, $y, $z, $ } from "@thi.ng/shader-ast/ast/swizzle";
import { assign } from "@thi.ng/shader-ast/ast/assign";
import { forLoop, ifThen, ternary } from "@thi.ng/shader-ast/ast/controlflow";

import { vmax3, vmax2 } from "./helpers";

// MIT License
//
// Copyright (c) 2011-2021 Mercury Demogroup
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

///////////////////////////////////////////////////////////////
//
//             PRIMITIVE DISTANCE FUNCTIONS
//
////////////////////////////////////////////////////////////////
//
// Conventions:
//
// Everything that is a distance function is called fSomething.
// The first argument is always a point in 2 or 3-space called <p>.
// Unless otherwise noted, (if the object has an intrinsic "up"
// side or direction) the y axis is "up" and the object is
// centered at the origin.
//
////////////////////////////////////////////////////////////////

export const fSphere = defn(
  "float",
  "fSphere",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(sub(length(p), r))];
  },
);

/**
 * Plane with normal n (n is normalized) at some distance from the origin
 */
export const fPlane = defn(
  "float",
  "fPlane",
  [
    ["vec3", "p"],
    ["vec3", "n"],
    ["float", "distanceFromOrigin"],
  ],
  (p, n, distanceFromOrigin) => {
    return [ret(add(dot(p, n), distanceFromOrigin))];
  },
);

/**
 * Cheap Box: distance to corners is overestimated
 */
export const fBoxCheap = defn(
  "float",
  "fBoxCheap",
  [
    ["vec3", "p"],
    ["vec3", "b"],
  ],
  (p, b) => {
    return [ret(vmax3(sub(abs(p), b)))];
  },
);

/**
 * Box: correct distance to corners
 */
// float fBox(vec3 p, vec3 b) {
// 	vec3 d = abs(p) - b;
// 	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
// }
export const fBox = defn(
  "float",
  "fBox",
  [
    ["vec3", "p"],
    ["vec3", "b"],
  ],
  (p, b) => {
    let d: Vec3Sym;
    return [
      (d = sym(sub(abs(p), b))),
      ret(add(length(max(d, VEC3_0)), vmax3(min(d, VEC3_0)))),
    ];
  },
);

// Same as above, but in two dimensions (an endless box)
// float fBox2Cheap(vec2 p, vec2 b) {
// 	return vmax(abs(p)-b);
// }
export const fBox2Cheap = defn(
  "float",
  "fBox2Cheap",
  [
    ["vec2", "p"],
    ["vec2", "b"],
  ],
  (p, b) => {
    return [ret(vmax2(sub(abs(p), b)))];
  },
);

export const fBox2 = defn(
  "float",
  "fBox2",
  [
    ["vec2", "p"],
    ["vec2", "b"],
  ],
  (p, b) => {
    let d: Vec2Sym;
    return [
      (d = sym(sub(abs(p), b))),
      ret(add(length(max(d, VEC2_0)), vmax2(min(d, VEC2_0)))),
    ];
  },
);

// Endless "corner"
export const fCorner = defn("float", "fCorner", ["vec2"], (p) => {
  return [ret(add(length(max(p, VEC2_0)), vmax2(min(p, VEC2_0))))];
});

// Blobby ball object. You've probably seen it somewhere. This is not a correct distance bound, beware.
export const fBlob = defn("float", "fBlob", [["vec3", "p"]], (p) => {
  let b: FloatSym;
  let l: FloatSym;
  return [
    assign(p, abs(p)),
    ifThen(lt($x(p), max($y(p), $z(p))), [assign(p, $(p, "yzx"))]),
    (b = sym(
      max(
        max(
          max(
            dot(p, normalize(VEC3_1)),
            dot($(p, "xz"), normalize(vec2(add(PHI, 1), 1))),
          ),
          dot($(p, "yx"), normalize(vec2(1, PHI))),
        ),
        dot($(p, "xz"), normalize(vec2(1, PHI))),
      ),
    )),
    (l = sym(length(p))),
    ret(
      sub(
        sub(l, 1.5),
        mul(
          float(0.2),
          mul(
            div(float(1.5), FLOAT2),
            cos(
              min(
                mul(sqrt(sub(float(1.01), div(b, l))), div(PI, float(0.25))),
                PI,
              ),
            ),
          ),
        ),
      ),
    ),
  ];
});

// Cylinder standing upright on the xz plane
export const fCylinder = defn(
  "float",
  "fCylinder",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "height"],
  ],
  (p, r, height) => {
    let d: FloatSym;
    return [
      (d = sym(sub(length($(p, "xz")), r))),
      assign(d, max(d, sub(abs($y(p)), height))),
      ret(d),
    ];
  },
);

// Capsule: A Cylinder with round caps on both sides
export const fCapsule = defn(
  "float",
  "fCapsule",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "c"],
  ],
  (p, r, c) => {
    return [
      ret(
        mix(
          sub(length($(p, "xz")), r),
          sub(length(vec3($x(p), sub(abs($y(p)), c), $z(p))), r),
          step(c, abs($y(p))),
        ),
      ),
    ];
  },
);

// Distance to line segment between <a> and <b>, used for fCapsule() version 2below
// float fLineSegment(vec3 p, vec3 a, vec3 b) {
// 	vec3 ab = b - a;
// 	float t = saturate(dot(p - a, ab) / dot(ab, ab));
// 	return length((ab*t + a) - p);
// }

// Capsule version 2: between two end points <a> and <b> with radius r
// float fCapsule(vec3 p, vec3 a, vec3 b, float r) {
// 	return fLineSegment(p, a, b) - r;
// }

// Torus in the XZ-plane
export const fTorus = defn(
  "float",
  "fTorus",
  [
    ["vec3", "p"],
    ["float", "smallRadius"],
    ["float", "largeRadius"],
  ],
  (p, smallRadius, largeRadius) => {
    return [
      ret(
        sub(
          length(vec2(sub(length($(p, "xz")), largeRadius), $y(p))),
          smallRadius,
        ),
      ),
    ];
  },
);

// A circle line. Can also be used to make a torus by subtracting the smaller radius of the torus.
export const fCircle = defn(
  "float",
  "fCircle",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    let l: FloatSym;
    return [(l = sym(sub(length($(p, "xz")), r))), ret(length(vec2($y(p), l)))];
  },
);

// A circular disc with no thickness (i.e. a cylinder with no height).
// Subtract some value to make a flat disc with rounded edge.
export const fDisc = defn(
  "float",
  "fDisc",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    let l: FloatSym;
    return [
      (l = sym(sub(length($(p, "xz")), r))),
      ret(ternary(lt(l, FLOAT0), abs($y(p)), length(vec2($y(p), l)))),
    ];
  },
);

// Hexagonal prism, circumcircle variant
export const fHexagonCircumcircle = defn(
  "float",
  "fHexagonCircumcircle",
  [
    ["vec3", "p"],
    ["vec2", "h"],
  ],
  (p, h) => {
    let q: Vec3Sym;
    return [
      (q = sym(abs(p))),
      ret(
        max(
          sub($y(q), $y(h)),
          sub(
            max(
              add(
                mul(mul($x(q), sqrt(float(3))), FLOAT05),
                mul($z(q), FLOAT05),
              ),
              $z(q),
            ),
            $x(h),
          ),
        ),
      ),
    ];
  },
);

// Hexagonal prism, incircle variant
export const fHexagonIncircle = defn(
  "float",
  "fHexagonIncircle",
  [
    ["vec3", "p"],
    ["vec2", "h"],
  ],
  (p, h) => {
    return [
      ret(
        fHexagonCircumcircle(
          p,
          vec2(mul(mul($x(h), sqrt(float(3))), FLOAT05), $y(h)),
        ),
      ),
    ];
  },
);

// Cone with correct distances to tip and base circle. Y is up, 0 is in the middle of the base.
export const fCone = defn(
  "float",
  "fCone",
  [
    ["vec3", "p"],
    ["float", "radius"],
    ["float", "height"],
  ],
  (p, radius, height) => {
    let q: Vec2Sym;
    let tip: Vec2Sym;
    let mantleDir: Vec2Sym;
    let mantle: FloatSym;
    let d: FloatSym;
    let projected: FloatSym;

    return [
      (q = sym(vec2(length($(p, "xz")), $y(p)))),
      (tip = sym(sub(q, vec2(FLOAT0, height)))),
      (mantleDir = sym(normalize(vec2(height, radius)))),
      (mantle = sym(dot(tip, mantleDir))),
      (d = sym(max(mantle, neg($y(q))))),
      (projected = sym(dot(tip, vec2($y(mantleDir), neg($x(mantleDir)))))),
      // distance to tip
      ifThen(and(gt($y(q), height), lt(projected, FLOAT0)), [
        assign(d, max(d, length(tip))),
      ]),
      // distance to base ring
      ifThen(
        and(gt($x(q), radius), gt(projected, length(vec2(height, radius)))),
        [assign(d, max(d, length(sub(q, vec2(radius, FLOAT0)))))],
      ),
      ret(d),
    ];
  },
);

//
// "Generalized Distance Functions" by Akleman and Chen.
// see the Paper at https://www.viz.tamu.edu/faculty/ergun/research/implicitmodeling/papers/sm99.pdf
//
// This set of constants is used to construct a large variety of geometric primitives.
// Indices are shifted by 1 compared to the paper because we start counting at Zero.
// Some of those are slow whenever a driver decides to not unroll the loop,
// which seems to happen for fIcosahedron und fTruncatedIcosahedron on nvidia 350.12 at least.
// Specialized implementations can well be faster in all cases.
//

export const GDFVectors = arraySym(
  "vec3",
  "GDFVectors",
  {
    num: 19,
    const: true,
  },
  [
    normalize(vec3(FLOAT1, FLOAT0, FLOAT0)),
    normalize(vec3(FLOAT0, FLOAT1, FLOAT0)),
    normalize(vec3(FLOAT0, FLOAT0, FLOAT1)),
    normalize(vec3(FLOAT1, FLOAT1, FLOAT1)),
    normalize(vec3(neg(FLOAT1), FLOAT1, FLOAT1)),
    normalize(vec3(FLOAT1, neg(FLOAT1), FLOAT1)),
    normalize(vec3(FLOAT1, FLOAT1, neg(FLOAT1))),
    normalize(vec3(FLOAT0, FLOAT1, add(PHI, 1))),
    normalize(vec3(FLOAT0, neg(FLOAT1), add(PHI, 1))),
    normalize(vec3(add(PHI, 1), FLOAT0, FLOAT1)),
    normalize(vec3(sub(neg(PHI), 1), FLOAT0, FLOAT1)),
    normalize(vec3(FLOAT1, add(PHI, 1), FLOAT0)),
    normalize(vec3(neg(FLOAT1), add(PHI, 1), FLOAT0)),
    normalize(vec3(FLOAT0, PHI, FLOAT1)),
    normalize(vec3(FLOAT0, neg(PHI), FLOAT1)),
    normalize(vec3(FLOAT1, FLOAT0, PHI)),
    normalize(vec3(neg(FLOAT1), FLOAT0, PHI)),
    normalize(vec3(PHI, FLOAT1, FLOAT0)),
    normalize(vec3(neg(PHI), FLOAT1, FLOAT0)),
  ],
);

// Version with variable exponent.
// This is slow and does not produce correct distances, but allows for bulging of objects.
// float fGDF(vec3 p, float r, float e, int begin, int end) {
// 	float d = 0;
// 	for (int i = begin; i <= end; ++i)
// 		d += pow(abs(dot(p, GDFVectors[i])), e);
// 	return pow(d, 1/e) - r;
// }
export const fGDFE = defn(
  "float",
  "fGDF",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
    ["int", "begin"],
    ["int", "end"],
  ],
  (p, r, e, begin, end) => {
    let d: FloatSym;

    return [
      (d = sym(float(0))),
      forLoop(
        sym(int(begin)),
        (i) => lte(i, end),
        inc,
        (i) => [assign(d, add(d, pow(abs(dot(p, index(GDFVectors, i))), e)))],
      ),
      ret(sub(pow(d, reciprocal(e)), r)),
    ];
  },
);

// Version with without exponent, creates objects with sharp edges and flat faces
export const fGDF = defn(
  "float",
  "fGDF",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["int", "begin"],
    ["int", "end"],
  ],
  (p, r, begin, end) => {
    let d: FloatSym;
    return [
      (d = sym(float(0))),
      forLoop(
        sym(int(begin)),
        (i) => lte(i, end),
        inc,
        (i) => [assign(d, max(d, abs(dot(p, index(GDFVectors, i)))))],
      ),
      ret(sub(d, r)),
    ];
  },
);

// Primitives follow:

export const fOctahedronE = defn(
  "float",
  "fOctahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
  ],
  (p, r, e) => {
    return [ret(fGDFE(p, r, e, int(3), int(6)))];
  },
);

export const fDodecahedronE = defn(
  "float",
  "fDodecahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
  ],
  (p, r, e) => {
    return [ret(fGDFE(p, r, e, int(13), int(18)))];
  },
);

export const fIcosahedronE = defn(
  "float",
  "fIcosahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
  ],
  (p, r, e) => {
    return [ret(fGDFE(p, r, e, int(3), int(12)))];
  },
);

export const fTruncatedOctahedronE = defn(
  "float",
  "fTruncatedOctahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
  ],
  (p, r, e) => {
    return [ret(fGDFE(p, r, e, int(0), int(6)))];
  },
);

export const fTruncatedIcosahedronE = defn(
  "float",
  "fTruncatedIcosahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
    ["float", "e"],
  ],
  (p, r, e) => {
    return [ret(fGDFE(p, r, e, int(3), int(18)))];
  },
);

export const fOctahedron = defn(
  "float",
  "fOctahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(fGDF(p, r, int(3), int(6)))];
  },
);

export const fDodecahedron = defn(
  "float",
  "fDodecahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(fGDF(p, r, int(13), int(18)))];
  },
);

export const fIcosahedron = defn(
  "float",
  "fIcosahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(fGDF(p, r, int(3), int(12)))];
  },
);

export const fTruncatedOctahedron = defn(
  "float",
  "fTruncatedOctahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(fGDF(p, r, int(0), int(6)))];
  },
);

export const fTruncatedIcosahedron = defn(
  "float",
  "fTruncatedIcosahedron",
  [
    ["vec3", "p"],
    ["float", "r"],
  ],
  (p, r) => {
    return [ret(fGDF(p, r, int(3), int(18)))];
  },
);
