import type { FloatSym, Vec2Sym } from "@thi.ng/shader-ast";
import { assign } from "@thi.ng/shader-ast/ast/assign";
import { sym } from "@thi.ng/shader-ast/ast/sym";
import {
  add,
  and,
  div,
  eq,
  lt,
  mul,
  neg,
  sub,
} from "@thi.ng/shader-ast/ast/ops";
import {
  max,
  min,
  sqrt,
  length,
  mod,
  abs,
} from "@thi.ng/shader-ast/builtin/math";
import { defn, ret } from "@thi.ng/shader-ast/ast/function";
import {
  float,
  FLOAT0,
  FLOAT05,
  FLOAT1,
  FLOAT2,
  SQRT2,
  vec2,
  VEC2_0,
} from "@thi.ng/shader-ast/ast/lit";
import { ifThen } from "@thi.ng/shader-ast/ast/controlflow";
import { $x, $y } from "@thi.ng/shader-ast/ast/swizzle";

import { pR45, pMod1 } from "./domain";

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

////////////////////////////////////////////////////////////////
//
//             OBJECT COMBINATION OPERATORS
//
////////////////////////////////////////////////////////////////
//
// We usually need the following boolean operators to combine two objects:
// Union: OR(a,b)
// Intersection: AND(a,b)
// Difference: AND(a,!b)
// (a and b being the distances to the objects).
//
// The trivial implementations are min(a,b) for union, max(a,b) for intersection
// and max(a,-b) for difference. To combine objects in more interesting ways to
// produce rounded edges, chamfers, stairs, etc. instead of plain sharp edges we
// can use combination operators. It is common to use some kind of "smooth minimum"
// instead of min(), but we don't like that because it does not preserve Lipschitz
// continuity in many cases.
//
// Naming convention: since they return a distance, they are called fOpSomething.
// The different flavours usually implement all the boolean operators above
// and are called fOpUnionRound, fOpIntersectionRound, etc.
//
// The basic idea: Assume the object surfaces intersect at a right angle. The two
// distances <a> and <b> constitute a new local two-dimensional coordinate system
// with the actual intersection as the origin. In this coordinate system, we can
// evaluate any 2D distance function we want in order to shape the edge.
//
// The operators below are just those that we found useful or interesting and should
// be seen as examples. There are infinitely more possible operators.
//
// They are designed to actually produce correct distances or distance bounds, unlike
// popular "smooth minimum" operators, on the condition that the gradients of the two
// SDFs are at right angles. When they are off by more than 30 degrees or so, the
// Lipschitz condition will no longer hold (i.e. you might get artifacts). The worst
// case is parallel surfaces that are close to each other.
//
// Most have a float argument <r> to specify the radius of the feature they represent.
// This should be much smaller than the object size.
//
// Some of them have checks like "if ((-a < r) && (-b < r))" that restrict
// their influence (and computation cost) to a certain area. You might
// want to lift that restriction or enforce it. We have left it as comments
// in some cases.
//
// usage example:
//
// float fTwoBoxes(vec3 p) {
//   float box0 = fBox(p, vec3(1));
//   float box1 = fBox(p-vec3(1), vec3(1));
//   return fOpUnionChamfer(box0, box1, 0.2);
// }
//
////////////////////////////////////////////////////////////////

/**
 * The "Chamfer" flavour makes a 45-degree chamfered edge
 * (the diagonal of a square of size <r>):
 */
export const fOpUnionChamfer = defn(
  "float",
  "fOpUnionChamfer",
  ["float", "float", "float"],
  (a, b, r) => {
    return [ret(min(min(a, b), mul(add(sub(a, r), b), sqrt(FLOAT05))))];
  },
);

/**
 * Intersection has to deal with what is normally the inside of the resulting object
 * when using union, which we normally don't care about too much. Thus, intersection
 * implementations sometimes differ from union implementations.
 */
export const fOpIntersectionChamfer = defn(
  "float",
  "fOpIntersectionChamfer",
  ["float", "float", "float"],
  (a, b, r) => {
    return [ret(max(max(a, b), mul(add(add(a, r), b), sqrt(FLOAT05))))];
  },
);

/**
 * Difference can be built from Intersection or Union:
 */
export const fOpDifferenceChamfer = defn(
  "float",
  "fOpDifferenceChamfer",
  ["float", "float", "float"],
  (a, b, r) => {
    return [ret(fOpIntersectionChamfer(a, neg(b), r))];
  },
);

/**
 * The "Round" variant uses a quarter-circle to join the two objects smoothly:
 */
export const fOpUnionRound = defn(
  "float",
  "fOpUnionRound",
  ["float", "float", "float"],
  (a, b, r) => {
    let u: Vec2Sym;
    return [
      (u = sym(max(vec2(sub(r, a), sub(r, b)), VEC2_0))),
      ret(sub(max(r, min(a, b)), length(u))),
    ];
  },
);

export const fOpIntersectionRound = defn(
  "float",
  "fOpIntersectionRound",
  ["float", "float", "float"],
  (a, b, r) => {
    let u: Vec2Sym;
    return [
      (u = sym(max(vec2(add(r, a), add(r, b)), VEC2_0))),
      ret(add(min(neg(r), max(a, b)), length(u))),
    ];
  },
);

export const fOpDifferenceRound = defn(
  "float",
  "fOpDifferenceRound",
  ["float", "float", "float"],
  (a, b, r) => {
    return [ret(fOpIntersectionRound(a, neg(b), r))];
  },
);

/**
 * The "Columns" flavour makes n-1 circular columns at a 45 degree angle:
 */
export const fOpUnionColumns = defn(
  "float",
  "fOpUnionColumns",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    let p: Vec2Sym;
    let columnRadius: FloatSym;
    let result: FloatSym;

    return [
      ifThen(
        and(lt(a, r), lt(b, r)),
        [
          (p = sym(vec2(a, b))),
          (columnRadius = sym(
            div(mul(r, SQRT2), add(mul(sub(n, FLOAT1), FLOAT2), SQRT2)),
          )),
          pR45(p),
          assign($x(p), sub($x(p), mul(div(SQRT2, FLOAT2), r))),
          assign($x(p), add($x(p), mul(columnRadius, SQRT2))),
          ifThen(eq(mod(n, FLOAT2), FLOAT1), [
            assign($y(p), add($y(p), columnRadius)),
          ]),
          // At this point, we have turned 45 degrees and moved at a point on the
          // diagonal that we want to place the columns on.
          // Now, repeat the domain along this direction and place a circle.
          pMod1($y(p), mul(columnRadius, FLOAT2)),
          (result = sym(sub(length(p), columnRadius))),
          assign(result, min(result, $x(p))),
          assign(result, min(result, a)),
          ret(min(result, b)),
        ],
        [ret(min(a, b))],
      ),
    ];
  },
);

export const fOpDifferenceColumns = defn(
  "float",
  "fOpDifferenceColumns",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    let p: Vec2Sym;
    let columnRadius: FloatSym;
    let result: FloatSym;

    let m: FloatSym;

    return [
      assign(a, neg(a)),
      (m = sym(min(a, b))),
      //avoid the expensive computation where not needed (produces discontinuity though)
      ifThen(
        and(lt(a, r), lt(b, r)),
        [
          (p = sym(vec2(a, b))),
          (columnRadius = sym(
            div(mul(r, SQRT2), add(mul(sub(n, FLOAT1), FLOAT2), SQRT2)),
          )),
          pR45(p),

          assign($y(p), add($y(p), columnRadius)),

          assign($x(p), sub($x(p), mul(div(SQRT2, FLOAT2), r))),
          // TODO:
          assign($x(p), add($x(p), div(mul(neg(columnRadius), SQRT2), FLOAT2))),

          ifThen(eq(mod(n, FLOAT2), FLOAT1), [
            assign($y(p), add($y(p), columnRadius)),
          ]),
          pMod1($y(p), mul(columnRadius, FLOAT2)),
          (result = sym(add(neg(length(p)), columnRadius))),
          assign(result, max(result, $x(p))),
          assign(result, min(result, a)),
          ret(neg(min(result, b))),
        ],
        [ret(neg(m))],
      ),
    ];
  },
);

export const fOpIntersectionColumns = defn(
  "float",
  "fOpIntersectionColumns",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    return [ret(fOpDifferenceColumns(a, neg(b), r, n))];
  },
);

/**
 * The "Stairs" flavour produces n-1 steps of a staircase:
 * much less stupid version by paniq
 */
export const fOpUnionStairs = defn(
  "float",
  "fOpUnionStairs",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    let s: FloatSym;
    let u: FloatSym;
    return [
      (s = sym(div(r, n))),
      (u = sym(sub(b, r))),
      ret(
        min(
          min(a, b),
          mul(
            0.5,
            add(add(u, a), abs(sub(mod(add(sub(u, a), s), mul(2, s)), s))),
          ),
        ),
      ),
    ];
  },
);

export const fOpIntersectionStairs = defn(
  "float",
  "fOpIntersectionStairs",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    return [ret(neg(fOpUnionStairs(neg(a), neg(b), r, n)))];
  },
);

export const fOpDifferenceStairs = defn(
  "float",
  "fOpDifferenceStairs",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
    ["float", "n"],
  ],
  (a, b, r, n) => {
    return [ret(neg(fOpUnionStairs(neg(a), b, r, n)))];
  },
);

/**
 * Similar to fOpUnionRound, but more lipschitz-y at acute angles
 * (and less so at 90 degrees). Useful when fudging around too much
 * by MediaMolecule, from Alex Evans' siggraph slides
 */
export const fOpUnionSoft = defn(
  "float",
  "fOpUnionSoft",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
  ],
  (a, b, r) => {
    let e: FloatSym;
    return [
      (e = sym(max(sub(r, abs(sub(a, b))), FLOAT0))),
      ret(sub(min(a, b), div(mul(mul(e, e), float(0.25)), r))),
    ];
  },
);

/**
 * produces a cylindical pipe that runs along the intersection.
 * No objects remain, only the pipe. This is not a boolean operator.
 */
export const fOpPipe = defn(
  "float",
  "fOpPipe",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
  ],
  (a, b, r) => {
    return [ret(sub(length(vec2(a, b)), r))];
  },
);

/**
 * first object gets a v-shaped engraving where it intersect the second
 */
export const fOpEngrave = defn(
  "float",
  "fOpEngrave",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "r"],
  ],
  (a, b, r) => {
    return [ret(max(a, mul(sub(add(a, r), abs(b)), sqrt(FLOAT05))))];
  },
);

/**
 * first object gets a capenter-style groove cut out
 */
export const fOpGroove = defn(
  "float",
  "fOpGroove",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "ra"],
    ["float", "rb"],
  ],
  (a, b, depth, thickness) => {
    return [ret(max(a, min(add(a, depth), sub(thickness, abs(b)))))];
  },
);

/**
 * first object gets a capenter-style tongue attached
 */
export const fOpTongue = defn(
  "float",
  "fOpTongue",
  [
    ["float", "a"],
    ["float", "b"],
    ["float", "depth"],
    ["float", "thickness"],
  ],
  (a, b, depth, thickness) => {
    return [ret(min(a, max(sub(a, depth), sub(abs(b), thickness))))];
  },
);
