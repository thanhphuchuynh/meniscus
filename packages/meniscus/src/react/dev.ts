/**
 * True in development builds. Bundlers replace `process.env.NODE_ENV`
 * statically; where nothing does (plain ESM in a browser), reading `process`
 * throws and warnings stay off.
 */
export const DEV: boolean = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();
