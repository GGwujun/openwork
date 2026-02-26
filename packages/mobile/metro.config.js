const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// 支持路径别名
config.resolver.alias = {
  ...config.resolver.alias,
  '@': './src',
  '@components': './src/components',
  '@screens': './src/screens',
  '@store': './src/store',
  '@api': './src/api',
  '@utils': './src/utils',
  '@hooks': './src/hooks',
  '@types': './src/types',
  '@constants': './src/constants'
};

module.exports = config;
