// webpack.config.js - Optimized for Healthcare App
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',
  entry: {
    main: './src/sherpa-app.js',
    styles: './src/styles/main.css'
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    clean: true
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.logs in production
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info'], // Remove specific functions
            unused: true, // Remove unused code
          },
          mangle: {
            safari10: true, // Fix Safari 10/11 bugs
          },
          format: {
            comments: false, // Remove all comments
          },
        },
        extractComments: false,
      }),
    ],

    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Separate vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          minSize: 10000, // Only create chunk if > 10KB
        },
        // Separate CSS animations (keep intact for healthcare UX)
        animations: {
          test: /[\\/]animations[\\/]/,
          name: 'animations',
          chunks: 'all',
          enforce: true,
        }
      }
    },

    usedExports: true, // Enable tree shaking
    sideEffects: false, // Mark all modules as side-effect free for better tree shaking
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: '> 0.25%, not dead',
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['postcss-preset-env'],
                  ['cssnano', {
                    preset: ['default', {
                      discardComments: { removeAll: true },
                      normalizeWhitespace: true,
                      minifyFontValues: true,
                      minifySelectors: true
                    }]
                  }]
                ]
              }
            }
          }
        ]
      }
    ]
  },

  plugins: [
    // Gzip compression
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192, // Only compress files > 8KB
      minRatio: 0.8
    }),

    // Bundle analysis (run with --analyze flag)
    ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : [])
  ],

  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils')
    }
  }
};