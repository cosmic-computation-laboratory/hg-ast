import { float, FLOAT0, FLOAT1, vec2 } from "@thi.ng/shader-ast/ast/lit";
import { defn, ret } from "@thi.ng/shader-ast/ast/function";
import { $x, $y, $z } from "@thi.ng/shader-ast/ast/swizzle";
import { ternary } from "@thi.ng/shader-ast/ast/controlflow";
import { lt } from "@thi.ng/shader-ast/ast/ops";
import { max } from "@thi.ng/shader-ast/builtin/math";

///////////////////////////////////////////////////////////////
//
//             HELPER FUNCTIONS/MACROS
//
////////////////////////////////////////////////////////////////

// #define PI 3.14159265
// #define TAU (2*PI)
// #define PHI (sqrt(5)*0.5 + 0.5)

// Clamp to [0,1] - this operation is free under certain circumstances.
// For further information see
// http://www.humus.name/Articles/Persson_LowLevelThinking.pdf and
// http://www.humus.name/Articles/Persson_LowlevelShaderOptimization.pdf
// #define saturate(x) clamp(x, 0, 1)

// Sign function that doesn't return 0
// float sgn(float x) {
// 	return (x<0)?-1:1;
// }
export const sgn = defn("float", "sgn", ["float"], (x) => {
  return [ret(ternary(lt(x, FLOAT0), float(-1), FLOAT1))];
});

export const sgn2 = defn("vec2", "sgn2", ["vec2"], (v) => {
  return [
    ret(
      vec2(
        ternary(lt($x(v), FLOAT0), float(-1), FLOAT1),
        ternary(lt($y(v), FLOAT0), float(-1), FLOAT1),
      ),
    ),
  ];
});

// vec2 sgn(vec2 v) {
// 	return vec2((v.x<0)?-1:1, (v.y<0)?-1:1);
// }

// float square (float x) {
// 	return x*x;
// }

// vec2 square (vec2 x) {
// 	return x*x;
// }

// vec3 square (vec3 x) {
// 	return x*x;
// }

// float lengthSqr(vec3 x) {
// 	return dot(x, x);
// }

// Maximum/minumum elements of a vector
export const vmax2 = defn("float", "vmax2", ["vec2"], (v) => {
  return [ret(max($x(v), $y(v)))];
});

export const vmax3 = defn("float", "vmax3", ["vec3"], (v) => {
  return [ret(max(max($x(v), $y(v)), $z(v)))];
});

// float vmax(vec4 v) {
// 	return max(max(v.x, v.y), max(v.z, v.w));
// }

// float vmin(vec2 v) {
// 	return min(v.x, v.y);
// }

// float vmin(vec3 v) {
// 	return min(min(v.x, v.y), v.z);
// }

// float vmin(vec4 v) {
// 	return min(min(v.x, v.y), min(v.z, v.w));
// }
