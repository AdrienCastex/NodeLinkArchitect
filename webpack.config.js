const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
    cache: false,
    mode: "development",
    entry: {
        main: "./src/index.tsx",
        'editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
		'json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
		'css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
		'html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
		'ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker'
    },
    output: {
		globalObject: 'self',
		filename: '[name].bundle.js',
        path: path.resolve(__dirname, './dist'),
        clean: true
    },
    resolve: {
        extensions: ["*", ".ts", ".tsx", ".js", ".css"]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[hash].css',
            chunkFilename: '[id].[hash].css'
        }),
        new MonacoWebpackPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.svg$/,
                loader: 'svg-inline-loader'
            },
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				use: ['file-loader']
			},
			{
				test: /\.txt$/,
				use: ['raw-loader']
			}
        ]
    }
};