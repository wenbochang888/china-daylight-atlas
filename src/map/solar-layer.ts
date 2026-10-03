import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';
import type { SunVector } from '../domain/types';
import { mapColors, nightOpacity } from './colors';
const nightRgb = [1, 3, 5].map(offset => parseInt(mapColors.night.slice(offset, offset + 2), 16) / 255);

const vertexSource = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_world;
void main() {
  v_world = a_pos;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;
const fragmentSource = `
precision highp float;
varying vec2 v_world;
uniform vec3 u_sun;
void main() {
  float mercator = 3.141592653589793 * (1.0 - 2.0 * v_world.y);
  float lat = 2.0 * atan(exp(mercator)) - 1.570796326794897;
  float lng = 6.283185307179586 * v_world.x - 3.141592653589793;
  vec3 ground = vec3(cos(lat) * cos(lng), cos(lat) * sin(lng), sin(lat));
  float altitude = degrees(asin(clamp(dot(ground, u_sun), -1.0, 1.0)));
  float night = 1.0 - smoothstep(-0.8433, -0.8233, altitude);
  float alpha = night * ${nightOpacity.toFixed(2)};
  gl_FragColor = vec4(vec3(${nightRgb.map(value => value.toFixed(8)).join(", ")}) * alpha, alpha);
}`;

export class SolarLayer implements CustomLayerInterface {
  readonly id = 'solar-overlay';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  private map?: Map;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private position = 0;
  private matrix?: WebGLUniformLocation | null;
  private sunUniform?: WebGLUniformLocation | null;
  private vector: SunVector = [1, 0, 0];

  setVector(vector: SunVector) { this.vector = vector; this.map?.triggerRepaint(); }
  onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    const shader = (type: number, source: string) => {
      const value = gl.createShader(type)!;
      gl.shaderSource(value, source); gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) ?? '昼夜图层初始化失败');
      return value;
    };
    const vertex = shader(gl.VERTEX_SHADER, vertexSource), fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('昼夜图层链接失败');
    this.position = gl.getAttribLocation(this.program, 'a_pos');
    this.matrix = gl.getUniformLocation(this.program, 'u_matrix');
    this.sunUniform = gl.getUniformLocation(this.program, 'u_sun');
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
  }
  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.program || !this.buffer) return;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.matrix!, false, args.defaultProjectionData.mainMatrix);
    gl.uniform3fv(this.sunUniform!, this.vector);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(this.position);
  }
  onRemove(_map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.map = undefined;
  }
}
