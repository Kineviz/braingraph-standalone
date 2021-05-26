const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";
  return {
    entry: "./src/index.jsx",
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /(node_modules|bower_components)/,
          loader: "babel-loader",
          options: {
            plugins: [isDevelopment && require.resolve("react-refresh/babel")].filter(Boolean),
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
      ],
    },
    resolve: { extensions: ["*", ".js", ".jsx"] },
    output: {
      path: path.resolve(__dirname, "dist/"),
      publicPath: "/dist/",
      filename: "bundle.js",
    },
    devServer: {
      contentBase: path.join(__dirname, "public/"),
      port: 3000,
      publicPath: "http://localhost:3000/dist/",
      hotOnly: true,
    },
    plugins: [
      new CopyPlugin({
        patterns: [{ from: "vendor" }],
      }),
      isDevelopment && new webpack.HotModuleReplacementPlugin(),
      isDevelopment && new ReactRefreshWebpackPlugin(),
    ].filter(Boolean),
  };
};
