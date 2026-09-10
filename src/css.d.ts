// Ambient declarations for CSS imports used by the web build
// (src/global.css, *.module.css). The generated SDK 57 template imports
// these but ships no type declarations for them.
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
