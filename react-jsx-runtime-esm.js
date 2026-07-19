const React = window.React;
export const jsx = (type, props, key) => {
  const { ref, ...rest } = props;
  const config = { ...rest };
  if (ref !== undefined) config.ref = ref;
  if (key !== undefined) config.key = key;
  return React.createElement(type, config);
};
export const jsxs = jsx;
export const Fragment = React.Fragment;
