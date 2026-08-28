/*
 * Ephemeral browser-session identity bridge.
 *
 * React components should use AuthContext directly. This tiny in-memory bridge
 * exists only for legacy non-React helpers (for example BOMFlow access helpers)
 * that cannot call React hooks. It intentionally does not use Web Storage and
 * is never a backend authorization boundary.
 */
let runtimeUser = null;

const cloneList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || ""))
    : [];

export const setRuntimeAuthUser = (user) => {
  if (!user) {
    runtimeUser = null;
    return null;
  }

  runtimeUser = Object.freeze({
    ...user,
    roles: Object.freeze(cloneList(user.roles)),
    modules: Object.freeze(cloneList(user.modules)),
    plantCodes: Object.freeze(cloneList(user.plantCodes)),
  });

  return runtimeUser;
};

export const clearRuntimeAuthUser = () => {
  runtimeUser = null;
};

export const getRuntimeAuthUser = () => runtimeUser;
