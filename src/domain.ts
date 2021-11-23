import type { FloatSym, Vec2Sym, Vec3Sym } from "@thi.ng/shader-ast";
import { ifThen } from "@thi.ng/shader-ast/ast/controlflow";
import { assign } from "@thi.ng/shader-ast/ast/assign";
import { defn, ret } from "@thi.ng/shader-ast/ast/function";
import {
  FLOAT0,
  FLOAT05,
  FLOAT1,
  FLOAT2,
  TAU,
  vec2,
  VEC2_1,
  VEC2_2,
} from "@thi.ng/shader-ast/ast/lit";
import {
  add,
  div,
  gt,
  gte,
  lt,
  mul,
  neg,
  sub,
} from "@thi.ng/shader-ast/ast/ops";
import { $, $x, $y } from "@thi.ng/shader-ast/ast/swizzle";
import {
  cos,
  floor,
  mod,
  sin,
  sqrt,
  length,
  abs,
  atan,
  dot,
} from "@thi.ng/shader-ast/builtin/math";
import { sym } from "@thi.ng/shader-ast/ast/sym";
import { cossin } from "@thi.ng/shader-ast-stdlib/math/sincos";

import { sgn, sgn2 } from "./helpers";

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
//                DOMAIN MANIPULATION OPERATORS
//
////////////////////////////////////////////////////////////////
//
// Conventions:
//
// Everything that modifies the domain is named pSomething.
//
// Many operate only on a subset of the three dimensions. For those,
// you must choose the dimensions that you want manipulated
// by supplying e.g. <p.x> or <p.zx>
//
// <inout p> is always the first argument and modified in place.
//
// Many of the operators partition space into cells. An identifier
// or cell index is returned, if possible. This return value is
// intended to be optionally used e.g. as a random seed to change
// parameters of the distance functions inside the cells.
//
// Unless stated otherwise, for cell index 0, <p> is unchanged and cells
// are centered on the origin so objects don't have to be moved to fit.
//
//
////////////////////////////////////////////////////////////////

/**
 * Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
 * Read like this: R(p.xz, a) rotates "x towards z".
 * This is fast if <a> is a compile-time constant and slower (but still practical) if not.
 */
export const pR = defn(
  "void",
  "pR",
  [
    ["vec2", "p", { q: "inout" }],
    ["float", "a"],
  ],
  (p, a) => {
    return [
      assign(p, add(mul(cos(a), p), mul(sin(a), vec2($y(p), neg($x(p)))))),
    ];
  },
);

/**
 * Shortcut for 45-degrees rotation
 */
export const pR45 = defn(
  "void",
  "pR45",
  [["vec2", "p", { q: "inout" }]],
  (p) => {
    return [assign(p, mul(add(p, vec2($y(p), neg($x(p)))), sqrt(FLOAT05)))];
  },
);

/**
 * Repeat space along one axis. Use like this to repeat along the x axis:
 * <float cell = pMod1(p.x,5);> - using the return value is optional
 */
export const pMod1 = defn(
  "float",
  "pMod1",
  [
    ["float", "p", { q: "inout" }],
    ["float", "size"],
  ],
  (p, size) => {
    let halfSize: FloatSym;
    let c: FloatSym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      ret(c),
    ];
  },
);

/**
 * Same, but mirror every second cell so they match at the boundaries
 */
export const pModMirror1 = defn(
  "float",
  "pModMirror1",
  [
    ["float", "p", { q: "inout" }],
    ["float", "size"],
  ],
  (p, size) => {
    let halfSize: FloatSym;
    let c: FloatSym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      assign(p, mul(p, sub(mul(mod(c, FLOAT2), FLOAT2), FLOAT1))),
      ret(c),
    ];
  },
);

/**
 * Repeat the domain only in positive direction. Everything in the negative half-space is unchanged.
 */
export const pModSingle1 = defn(
  "float",
  "pMod1",
  [
    ["float", "p", { q: "inout" }],
    ["float", "size"],
  ],
  (p, size) => {
    let halfSize: FloatSym;
    let c: FloatSym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      ifThen(gte(p, FLOAT0), [
        assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      ]),
      ret(c),
    ];
  },
);

/**
 * Repeat only a few times: from indices <start> to <stop> (similar to above, but more flexible)
 */
/**
 * Repeat space along one axis. Use like this to repeat along the x axis:
 * <float cell = pMod1(p.x,5);> - using the return value is optional
 */
export const pModInterval1 = defn(
  "float",
  "pModInterval1",
  [
    ["float", "p", { q: "inout" }],
    ["float", "size"],
    ["float", "start"],
    ["float", "end"],
  ],
  (p, size, start, stop) => {
    let halfSize: FloatSym;
    let c: FloatSym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      ifThen(gt(c, stop), [
        //yes, this might not be the best thing numerically.
        assign(p, add(p, mul(size, sub(c, stop)))),
        assign(c, stop),
      ]),
      ifThen(lt(c, start), [
        assign(p, add(p, mul(size, sub(c, start)))),
        assign(c, start),
      ]),
      ret(c),
    ];
  },
);

/**
 * Repeat around the origin by a fixed angle.
 * For easier use, num of repetitions is use to specify the angle.
 */
export const pModPolar = defn(
  "float",
  "pModPolar",
  [
    ["vec2", "p", { q: "inout" }],
    ["float", "repetitions"],
  ],
  (p, repetitions) => {
    let angle: FloatSym;
    let a: FloatSym;
    let r: FloatSym;
    let c: FloatSym;
    return [
      (angle = sym(div(TAU, repetitions))),
      (a = sym(add(atan($y(p), $x(p)), div(angle, FLOAT2)))),
      (r = sym(length(p))),
      (c = sym(floor(div(a, angle)))),
      assign(a, sub(mod(a, angle), div(angle, FLOAT2))),
      assign(p, mul(cossin(a), r)),
      // For an odd number of repetitions, fix cell index of the cell in -x direction
      // (cell index would be e.g. -5 and 5 in the two halves of the cell):
      ifThen(gte(abs(c), div(repetitions, FLOAT2)), [assign(c, abs(c))]),
      ret(c),
    ];
  },
);

/**
 * Repeat in two dimensions
 */
export const pMod2 = defn(
  "vec2",
  "pMod2",
  [
    ["vec2", "p", { q: "inout" }],
    ["vec2", "size"],
  ],
  (p, size) => {
    let halfSize: Vec2Sym;
    let c: Vec2Sym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      ret(c),
    ];
  },
);

/**
 * Same, but mirror every second cell so all boundaries match
 */
export const pModMirror2 = defn(
  "vec2",
  "pModMirror2",
  [
    ["vec2", "p", { q: "inout" }],
    ["vec2", "size"],
  ],
  (p, size) => {
    let halfSize: Vec2Sym;
    let c: Vec2Sym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      assign(p, mul(p, sub(mul(mod(c, VEC2_2), FLOAT2), VEC2_1))),
      ret(c),
    ];
  },
);

/**
 * Same, but mirror every second cell at the diagonal as well
 */
export const pModGrid2 = defn(
  "vec2",
  "pModGrid2",
  [
    ["vec2", "p", { q: "inout" }],
    ["vec2", "size"],
  ],
  (p, size) => {
    let halfSize: Vec2Sym;
    let c: Vec2Sym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      assign(p, mul(p, sub(mul(mod(c, VEC2_2), FLOAT2), VEC2_1))),
      assign(p, sub(p, halfSize)),
      ifThen(gt($x(p), $y(p)), [assign($(p, "xy"), $(p, "yx"))]),
      ret(floor(div(c, FLOAT2))),
    ];
  },
);

/**
 * Repeat in three dimensions
 */
export const pMod3 = defn(
  "vec3",
  "pMod3",
  [
    ["vec3", "p", { q: "inout" }],
    ["vec3", "size"],
  ],
  (p, size) => {
    let halfSize: Vec3Sym;
    let c: Vec3Sym;
    return [
      (halfSize = sym(mul(size, FLOAT05))),
      (c = sym(floor(div(add(p, halfSize), size)))),
      assign(p, sub(mod(add(p, halfSize), size), halfSize)),
      ret(c),
    ];
  },
);

/**
 * Mirror at an axis-aligned plane which is at a specified distance <dist> from the origin.
 */
export const pMirror = defn(
  "float",
  "pMirror",
  [
    ["float", "p", { q: "inout" }],
    ["float", "dist"],
  ],
  (p, dist) => {
    let s: FloatSym;
    return [(s = sym(sgn(p))), assign(p, sub(abs(p), dist)), ret(s)];
  },
);

/**
 * Mirror in both dimensions and at the diagonal, yielding one eighth of the space.
 * translate by dist before mirroring.
 */
export const pMirrorOctant = defn(
  "vec2",
  "pMirrorOctant",
  [
    ["vec2", "p", { q: "inout" }],
    ["vec2", "dist"],
  ],
  (p, dist) => {
    let s: Vec2Sym;
    return [
      (s = sym(sgn2(p))),
      pMirror($x(p), $x(dist)),
      pMirror($y(p), $y(dist)),
      ifThen(gt($y(p), $x(p)), [assign($(p, "xy"), $(p, "yx"))]),
      ret(s),
    ];
  },
);

/**
 * Reflect space at a plane
 */
export const pReflect = defn(
  "float",
  "pReflect",
  [
    ["vec3", "p", { q: "inout" }],
    ["vec3", "planeNormal"],
    ["float", "offset"],
  ],
  (p, planeNormal, offset) => {
    let t: FloatSym;
    return [
      (t = sym(add(dot(p, planeNormal), offset))),
      ifThen(lt(t, FLOAT0), [
        assign(p, sub(p, mul(mul(FLOAT2, t), planeNormal))),
      ]),
      ret(sgn(t)),
    ];
  },
);
