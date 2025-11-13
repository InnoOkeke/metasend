// Polyfills required by Coinbase CDP SDK
import "react-native-get-random-values";
import { install as installQuickCrypto } from "react-native-quick-crypto";
import structuredClone from "@ungap/structured-clone";

if (!("structuredClone" in globalThis)) {
  globalThis.structuredClone = structuredClone as any;
}

installQuickCrypto();

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
