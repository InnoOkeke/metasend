const QuickCrypto = require('react-native-quick-crypto');

const implementation = QuickCrypto.default || QuickCrypto;

module.exports = {
    ...implementation,
    randomBytes: implementation.randomBytes,
    getRandomValues: implementation.getRandomValues,
    createHash: implementation.createHash,
    createHmac: implementation.createHmac,
    createCipheriv: implementation.createCipheriv,
    createDecipheriv: implementation.createDecipheriv,
    // Ensure we export ourselves as default too for ES module interop
    default: implementation
};
