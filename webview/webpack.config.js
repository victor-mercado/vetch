import path from 'path';
import { fileURLToPath } from 'url';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/main.jsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'assets/index.js',
        // Ensure URLs to local assets are generated relative to the bundle
        publicPath: ''
    },
    resolve: {
        extensions: ['.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules\/(?!scratch-paint\/)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            ['@babel/preset-react', { runtime: 'automatic' }] // Enables React 17+ JSX transform
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                auto: (resourcePath) => {
                                    // Apply CSS modules only to scratch-paint CSS files
                                    // or any file that naturally ends in .module.css
                                    return resourcePath.includes('scratch-paint') || resourcePath.endsWith('.module.css');
                                },
                                localIdentName: '[name]_[local]_[hash:base64:5]',
                                namedExport: false,
                                exportLocalsConvention: 'camelCase'
                            },
                            importLoaders: 1 // Important for PostCSS to process @imports inside CSS modules first
                        }
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: [
                                    ['postcss-import'],
                                    ['postcss-simple-vars', {
                                        unknown: function (node, name, result) {
                                            node.warn(result, 'Unknown variable ' + name);
                                        }
                                    }],
                                    ['postcss-nested']
                                ]
                            }
                        }
                    }
                ]
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/inline' // Inlines assets to avoid broken VS Code Webview URLs
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'assets/index.css' // Same output structure as Vite layout
        })
    ]
};
