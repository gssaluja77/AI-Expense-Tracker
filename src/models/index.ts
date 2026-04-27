/**
 * Model barrel — import side-effects guarantee that every Mongoose model is
 * registered on the active connection before queries run. This is important
 * in Next.js where individual route handlers may only import a subset.
 */

export { default as User } from "./User";
export { default as Transaction } from "./Transaction";
export { default as Category } from "./Category";
export { default as Budget } from "./Budget";
export { default as Subscription } from "./Subscription";
