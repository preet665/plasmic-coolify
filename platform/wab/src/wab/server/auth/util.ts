import { User } from "@/wab/server/entities/Entities";
import { makeUserTraits } from "@/wab/server/routes/util";
import { disconnectUserSockets } from "@/wab/server/socket-util";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import { TeamWhiteLabelInfo } from "@/wab/shared/ApiSchema";
import { spawn } from "@/wab/shared/common";
import OktaJwtVerifier from "@okta/jwt-verifier";
import { Request } from "express-serve-static-core";

export function doLogin(
  request: Request,
  user: User,
  done: (err: any) => void
) {
  console.log(`[doLogin] ENTER: Attempting login for user ID: ${user.id}. Current sessionID: ${request.sessionID}`);
  spawn(
    (async () => { // Wrap in async IIFE for better logging context
      console.log(`[doLogin] Inside spawn for user ID: ${user.id}`);
      try {
        console.log(`[doLogin] Calling disconnectUserSockets for user ID: ${user.id}`);
        await disconnectUserSockets(request);
        console.log(`[doLogin] disconnectUserSockets completed for user ID: ${user.id}. Calling request.logIn...`);
        request.logIn(user, (loginErr) => {
          console.log(`[doLogin] request.logIn callback invoked for user ID: ${user.id}. Error: ${loginErr}`);
          if (!loginErr) {
            console.log(`[doLogin] request.logIn successful for user ID: ${user.id}. Calling analytics.identify...`);
            try {
              request.analytics.identify(user.id, makeUserTraits(user));
              console.log(`[doLogin] analytics.identify completed for user ID: ${user.id}.`);
            } catch (analyticsErr) {
              console.error(`[doLogin] Error during analytics.identify for user ID: ${user.id}:`, analyticsErr);
              // Decide if analytics error should prevent login completion? Currently, it doesn't.
            }
          }
          console.log(`[doLogin] Calling original done callback for user ID: ${user.id}.`);
          done(loginErr); // Call the original done callback
        });
        console.log(`[doLogin] Call to request.logIn initiated for user ID: ${user.id}.`);
      } catch (disconnectErr) {
        console.error(`[doLogin] Error during disconnectUserSockets for user ID: ${user.id}:`, disconnectErr);
        done(disconnectErr); // Pass disconnect error to the done callback
      }
      console.log(`[doLogin] Exiting spawn block for user ID: ${user.id}.`);
    })()
  );
  console.log(`[doLogin] EXIT: Spawn initiated for user ID: ${user.id}.`);
}

export async function doLogout(request: Request) {
  await disconnectUserSockets(request);
  return new Promise((resolve) => {
    // Requests forwarded to socket server do not set up passport
    if (typeof request.logout === "function") {
      request.logout(resolve);
    } else {
      resolve(true);
    }
  });
}

export async function verifyClientCredentials(
  whiteLabelName: string,
  token: string,
  info: Exclude<TeamWhiteLabelInfo["apiClientCredentials"], undefined>
) {
  const verifier = new OktaJwtVerifier({
    issuer: info.issuer,
    clientId: info.clientId,
    assertClaims: {
      cid: info.clientId,
    },
  });
  try {
    await verifier.verifyAccessToken(token, info.aud);
  } catch (err) {
    console.error(
      `Failed to verify client credentials for ${whiteLabelName}: ${token}: ${err}`
    );
    throw new ForbiddenError(`Invalid client token: ${err.userMessage}`);
  }
}
