module.exports = (opts = {}) => {
  const {prefix} = opts;

  return {
    postcssPlugin: "prefix-all-selectors",
    Root(root, postcss) {
      root.nodes.forEach((node) => {
        const omitPrefix = "no-prefix";
        if (node.selector) {
          if (!node.selector.startsWith(omitPrefix)) {
            const split = node.selector.split(",");
            const prefixed = split.map((s) => `${prefix} ${s}`);
            const joined = prefixed.join(",");
            node.selector = joined;
          } else {
            node.selector = node.selector.slice(omitPrefix.length)
            node.nodes.forEach(n => {
              n.value += ' !important';
            })
          }
        }
      });
    },

    /*
    Declaration (decl, postcss) {
      // The faster way to find Declaration node
    }
    */

    /*
    Declaration: {
      color: (decl, postcss) {
        // The fastest way find Declaration node if you know property name
      }
    }
    */
  };
};
module.exports.postcss = true;
