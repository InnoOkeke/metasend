import QuickCrypto, { install as installQuickCrypto } from "react-native-quick-crypto";
import cryptoShim from "./crypto-polyfill";
import structuredClone from "@ungap/structured-clone";
import { registerRootComponent } from "expo";
import App from "./App";

// Install quick crypto polyfill
installQuickCrypto();

// Polyfill global crypto, window, self, and structuredClone if missing
const polyfillCrypto = () => {
  // Ensure global.crypto exists
  if (!(global as any).crypto) {
    (global as any).crypto = cryptoShim;
  } else {
    // Ensure randomBytes is present on global.crypto
    if (!(global as any).crypto.randomBytes) {
      (global as any).crypto.randomBytes = cryptoShim.randomBytes;
    }
  }

  // Polyfill window and self for libraries that expect them
  if (typeof (global as any).window === "undefined") {
    (global as any).window = global;
  }
  if (typeof (global as any).self === "undefined") {
    (global as any).self = global;
  }

  // Assign crypto to window and self if not already present
  if (!(global as any).window.crypto) {
    (global as any).window.crypto = (global as any).crypto;
  }
  if (!(global as any).self.crypto) {
    (global as any).self.crypto = (global as any).crypto;
  }

  // Polyfill structuredClone if missing
  if (!("structuredClone" in globalThis)) {
    (globalThis as any).structuredClone = structuredClone as any;
  }
};

polyfillCrypto();
(global as any).browserCrypto = (global as any).crypto;
(globalThis as any).browserCrypto = (global as any).crypto;

// Log crypto availability for debugging
console.log("Global crypto:", !!(global as any).crypto);
console.log("Global crypto.subtle:", !!(global as any).crypto?.subtle);
console.log("Global crypto.subtle.digest:", !!(global as any).crypto?.subtle?.digest);

// Register the main application component
registerRootComponent(App);
