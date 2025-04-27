import { ensureIsHostFrame, isHostFrame } from "@/wab/client/cli-routes";
import {
  providesFrameCtx,
  useFrameCtx,
} from "@/wab/client/frame-ctx/frame-ctx";
import { FrameMessage } from "@/wab/client/frame-ctx/frame-message-types";
import { HostFrameApi } from "@/wab/client/frame-ctx/host-frame-api";
import { getPlasmicStudioArgs } from "@/wab/client/frame-ctx/plasmic-studio-args";
import { TopFrameFullApi } from "@/wab/client/frame-ctx/top-frame-api";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { ensure, spawn, spawnWrapper } from "@/wab/shared/common";
import * as Comlink from "comlink";
import {
  Action,
  History,
  Href,
  Location,
  LocationDescriptor,
  LocationDescriptorObject,
  LocationListener,
  Path,
  TransitionPromptHook,
  UnregisterCallback,
  createMemoryHistory,
} from "history";
import * as React from "react";

export interface HostFrameCtx {
  topFrameApi: PromisifyMethods<TopFrameFullApi>;
  history: History;
  onHostFrameApiReady: (api: HostFrameApi) => void;
}

export interface HostFrameCtxProviderProps {
  children?: React.ReactNode;
}

export function HostFrameCtxProvider({ children }: HostFrameCtxProviderProps) {
  ensureIsHostFrame();

  const [hostFrameCtx, setHostFrameCtx] = React.useState<
    HostFrameCtx | undefined
  >(undefined);

  React.useEffect(() => {
    // This should be the same thing as window.top, but we'll just stick with a
    // 'relative path' in case the top-most frame ever wants to run inside an
    // iframe itself.
    const topFrame = ensure(window.parent?.parent, "Missing top frame");

    const plasmicOrigin = getPlasmicStudioArgs().origin;

    console.log("[HostFrame] Sending PLASMIC_HOST_REGISTERED message");
    topFrame.postMessage(
      { type: FrameMessage.PlasmicHostRegister },
      plasmicOrigin
    );

    const topFrameApi: PromisifyMethods<TopFrameFullApi> = Comlink.wrap(
      Comlink.windowEndpoint(topFrame, self, plasmicOrigin)
    );

    const hostHistory = new HostHistory(topFrameApi);

    setHostFrameCtx({
      history: hostHistory,
      topFrameApi,
      onHostFrameApiReady: (api) => {
        console.log("[HostFrame] HostFrameApi ready, exposing API to TopFrame");
        // complex objects sent over Comlink must be proxied
        spawn(topFrameApi.exposeHostFrameApi(Comlink.proxy(api)));
      },
    });

    // Initialize the history listener *after* context is set
    spawn(hostHistory.initialize());

    return spawnWrapper(hostHistory.dispose);
  }, []);

  // block children until connected to TopFrame
  return providesFrameCtx(hostFrameCtx)(hostFrameCtx ? children : null);
}

/**
 * Returns HostFrameCtx.
 * @throws if not HostFrame
 * @throws if HostFrameCtx not provided
 */
export function useHostFrameCtx(): HostFrameCtx {
  ensureIsHostFrame();
  return useFrameCtx();
}

/**
 * Returns HostFrameCtx if host frame, undefined otherwise.
 * @throws if HostFrameCtx not provided
 */
export function useHostFrameCtxIfHostFrame(): HostFrameCtx | undefined {
  return isHostFrame() ? useFrameCtx() : undefined;
}

/**
 * A wrapper around a MemoryHistory that is kept in sync with the top frame's history.
 *
 * All "read" methods are supported.
 * Only push and replace "write" methods are supported.
 */
class HostHistory implements History<unknown> {
  private readonly memoryHistory = createMemoryHistory();
  private unregisterLocationListenerPromise: Promise<() => void> | undefined;
  private isInitialized = false;

  constructor(private readonly topFrameApi: PromisifyMethods<TopFrameFullApi>) {
    // Initialize immediately to avoid race conditions
    this.initialize().catch(err => {
      console.error("[HostHistory] Failed to initialize during construction:", err);
    });
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }
    console.log("[HostHistory] Initializing location listener...");
    try {
      this.unregisterLocationListenerPromise = this.initializeLocationListener();
      // Wait for the listener to actually be registered before marking as initialized
      await this.unregisterLocationListenerPromise;
      this.isInitialized = true;
      console.log("[HostHistory] Location listener initialized successfully.");
      // Initial sync might need coordination with TopFrameChrome side.
      // TopFrameChrome's registerLocationListener implementation already sends
      // the initial location upon successful registration.
    } catch (error) {
       console.error("[HostHistory] Failed to initialize location listener:", error);
    }
  }

  private initializeLocationListener(): Promise<() => void> {
    return new Promise(async (resolve, reject) => {
      // Additional validation before attempting to use topFrameApi
      if (!this.topFrameApi) {
        const errorMsg = "[HostHistory] topFrameApi is not available during initialization.";
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      if (typeof this.topFrameApi.registerLocationListener !== 'function') {
        const errorMsg = "[HostHistory] topFrameApi.registerLocationListener is not a function during initialization.";
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      try {
        console.log("[HostHistory] Attempting to call topFrameApi.registerLocationListener...");
        const unregister = await this.topFrameApi.registerLocationListener(
          Comlink.proxy((location: Location, action: Action) => {
            // Added check for location object itself
            if (!location || typeof location !== 'object') {
              console.error("[HostHistory Listener] Received invalid location object:", location);
              return;
            }

            // Check for necessary properties before accessing them
            if (typeof location.pathname !== 'string' || typeof location.search !== 'string' || typeof location.hash !== 'string') {
               console.error("[HostHistory Listener] Received location object with missing properties:", location);
               return;
            }

            const path = location.pathname + location.search + location.hash;
            console.log(
              `[HostHistory Listener] Received: ${action} ${location.key ?? 'nokey'} ${path}`
            );

            try {
              switch (action) {
                case "PUSH": {
                  this.memoryHistory.push(path, location.key);
                  break;
                }
                case "REPLACE": {
                  this.memoryHistory.replace(path, location.key);
                  break;
                }
                case "POP": {
                  const targetIndex = this.memoryHistory.entries.findIndex(
                    (entry) => entry.state === location.key
                  );
                  if (targetIndex >= 0) {
                    this.memoryHistory.go(targetIndex - this.memoryHistory.index);
                  } else {
                    this.memoryHistory.push(path, location.key);
                  }
                  break;
                }
                default:
                   console.warn(`[HostHistory Listener] Received unknown action: ${action}`);
              }
            } catch (error) {
              console.error("[HostHistory Listener] Error processing action:", action, error);
            }
          })
        );
        
        console.log("[HostHistory] Successfully registered location listener via topFrameApi.");
        // Ensure unregister is a function before resolving
        if (typeof unregister === 'function') {
            resolve(unregister);
        } else {
            console.error("[HostHistory] registerLocationListener did not return a function.");
            resolve(() => {}); // Resolve with no-op if invalid response
        }
      } catch (error) {
        console.error("[HostHistory] Error calling topFrameApi.registerLocationListener:", error);
        reject(error); // Reject the promise if the API call fails
      }
    });
  }

  dispose = async () => {
    console.log("[HostHistory] Disposing...");
    try {
      if (this.unregisterLocationListenerPromise) {
         // Prevent errors if promise was rejected during init
         const unregister = await this.unregisterLocationListenerPromise.catch(err => {
             console.warn("[HostHistory] Could not get unregister function during dispose (init likely failed):", err);
             return undefined;
         });
        if (unregister && typeof unregister === 'function') {
          console.log("[HostHistory] Calling unregister function.");
          unregister();
        } else if (unregister) {
           console.warn("[HostHistory] Unregister value obtained but is not a function:", unregister);
        }
      } else {
         console.log("[HostHistory] No listener promise found to unregister.");
      }
    } catch (error) {
      console.error("[HostHistory] Error during dispose:", error);
    }
  };

  get action() {
    return this.memoryHistory.action;
  }
  block = (
    _prompt: boolean | string | TransitionPromptHook | undefined
  ): UnregisterCallback => {
    console.warn("HostHistory method 'block' is unsupported.");
    return () => {}; // Return no-op
  };
  createHref = (location: LocationDescriptorObject): Href => {
    return this.memoryHistory.createHref(location);
  };
  get length() {
    return this.memoryHistory.length;
  }
  listen = (listener: LocationListener): UnregisterCallback => {
    return this.memoryHistory.listen(listener);
  };
  get location() {
    return this.memoryHistory.location;
  }
  go = (_n: number): void => {
     console.error("HostHistory method 'go' is unsupported.");
     throw new Error("unsupported HostHistory method: go");
  };
  goBack = (): void => {
     console.error("HostHistory method 'goBack' is unsupported.");
     throw new Error("unsupported HostHistory method: goBack");
  };
  goForward = (): void => {
    console.error("HostHistory method 'goForward' is unsupported.");
    throw new Error("unsupported HostHistory method: goForward");
  };

  push = (path: Path | LocationDescriptor, _state?: unknown): void => {
    console.log("[HostHistory] push called:", path);
    if (!this.topFrameApi || typeof this.topFrameApi.pushLocation !== 'function') {
       console.error("[HostHistory] Cannot push: topFrameApi.pushLocation is not available or not a function.");
       return;
    }
    try {
      const { pathname, search, hash } = toPathSearchHash(path);
      spawn(this.topFrameApi.pushLocation(pathname, search, hash));
    } catch (error) {
      console.error("[HostHistory] Error during push:", error);
    }
  };

  replace = (path: Path | LocationDescriptor, _state?: unknown): void => {
     console.log("[HostHistory] replace called:", path);
     if (!this.topFrameApi || typeof this.topFrameApi.replaceLocation !== 'function') {
       console.error("[HostHistory] Cannot replace: topFrameApi.replaceLocation is not available or not a function.");
       return;
     }
     try {
       const { pathname, search, hash } = toPathSearchHash(path);
       spawn(this.topFrameApi.replaceLocation(pathname, search, hash));
     } catch (error) {
       console.error("[HostHistory] Error during replace:", error);
     }
  };
}

function toPathSearchHash(path: Path | LocationDescriptor): {
  pathname?: string;
  search?: string;
  hash?: string;
} {
  try {
    // Handle potential errors if path is not a valid string or object for URL parsing
    if (typeof path === "string") {
        const url = new URL(path, "http://dummy-base"); // Use dummy base for relative paths
        return { pathname: url.pathname, search: url.search, hash: url.hash };
    } else if (path && typeof path === 'object' && ('pathname' in path || 'search' in path || 'hash' in path)) {
        // Basic check if it looks like a LocationDescriptor object
        return { pathname: path.pathname, search: path.search, hash: path.hash };
    } else {
        console.error("Invalid path format in toPathSearchHash:", path);
        return {}; // Return empty object on failure
    }
  } catch (error) {
      console.error("Error parsing path in toPathSearchHash:", path, error);
      return {}; // Return empty object on parsing error
  }
}
