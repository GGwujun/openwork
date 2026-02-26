module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@store': './src/store',
            '@api': './src/api',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@types': './src/types',
            '@constants': './src/constants'
          }
        }
      ]
    ]
  };
};
