/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as admins from "../admins.js";
import type * as allowlist from "../allowlist.js";
import type * as auth from "../auth.js";
import type * as authValidation from "../authValidation.js";
import type * as collections from "../collections.js";
import type * as editorial from "../editorial.js";
import type * as http from "../http.js";
import type * as photos from "../photos.js";
import type * as profiles from "../profiles.js";
import type * as router from "../router.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  admins: typeof admins;
  allowlist: typeof allowlist;
  auth: typeof auth;
  authValidation: typeof authValidation;
  collections: typeof collections;
  editorial: typeof editorial;
  http: typeof http;
  photos: typeof photos;
  profiles: typeof profiles;
  router: typeof router;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
