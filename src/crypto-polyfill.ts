import 'react-native-get-random-values';

// Minimal crypto shim exposing randomBytes and delegating to global.crypto.getRandomValues
const cryptoShim: any = {
  getRandomValues: (arr: Uint8Array) => {
    if (typeof (global as any).crypto?.getRandomValues === 'function') {
      return (global as any).crypto.getRandomValues(arr);
    }
    // fallback to react-native-quick-crypto if available
    try {
      // require at runtime to avoid bundler issues
      const quick = require('react-native-quick-crypto');
      if (quick && typeof quick.getRandomValues === 'function') {
        return quick.getRandomValues(arr);
      }
    } catch (e) {
      // ignore
    }
    throw new Error('No secure random number generator available');
  },

  randomBytes: (size: number) => {
    const arr = new Uint8Array(size);
    cryptoShim.getRandomValues(arr);
    // If Buffer exists (polyfilled by metro), return Buffer
    if (typeof (global as any).Buffer !== 'undefined') {
      return (global as any).Buffer.from(arr);
    }
    return arr;
  },
};

export default cryptoShim;
