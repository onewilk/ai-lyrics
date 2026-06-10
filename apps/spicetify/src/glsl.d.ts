// GLSL 着色器以字符串形式导入（esbuild text loader）。
declare module "*.glsl" {
  const src: string;
  export default src;
}
