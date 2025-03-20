// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolution for native modules
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'cjs', 'json', 'native'];
config.resolver.assetExts = ['bmp', 'gif', 'jpg', 'jpeg', 'png', 'psd', 'svg', 'webp', 'ttf', 'mp3', 'wav'];

// No need for specific module resolutions anymore
config.resolver.extraNodeModules = {};

module.exports = config; 