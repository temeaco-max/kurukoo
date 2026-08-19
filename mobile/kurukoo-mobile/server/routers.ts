import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { confirmDevicePairing, createDevicePairing, deleteStoredArtifact, getCapabilityPortfolio, listConnectedDevices, listStoredArtifacts, migrateArtifactToGoogleDrive, revokeConnectedDevice, syncVoiceNote } from "./_core/osCapabilityService";
import { beginGoogleDriveAuthorization, getGoogleDriveConnectionStatus, revokeGoogleDrive } from "./_core/googleDriveService";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  os: router({
    portfolio: protectedProcedure.query(({ ctx }) => getCapabilityPortfolio(ctx.user.id)),
    artifacts: router({
      list: protectedProcedure.input(z.object({ search: z.string().max(120).optional(), from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(), to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional() }).optional()).query(({ ctx, input }) => listStoredArtifacts(ctx.user.id, input ?? {})),
      deleteReference: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteStoredArtifact(ctx.user.id, input.id, false)),
      deleteOriginal: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteStoredArtifact(ctx.user.id, input.id, true)),
      migrateToGoogleDrive: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => migrateArtifactToGoogleDrive(ctx.user.id, input.id)),
    }),
    storage: router({
      googleDriveStatus: protectedProcedure.query(({ ctx }) => getGoogleDriveConnectionStatus(ctx.user.id)),
      beginGoogleDriveAuthorization: protectedProcedure.mutation(({ ctx }) => beginGoogleDriveAuthorization(ctx.user.id)),
      revokeGoogleDrive: protectedProcedure.mutation(({ ctx }) => revokeGoogleDrive(ctx.user.id)),
    }),
    devices: router({
      list: protectedProcedure.query(({ ctx }) => listConnectedDevices(ctx.user.id)),
      createPairing: protectedProcedure.input(z.object({ label: z.string().min(1).max(120), platform: z.string().min(1).max(32), deviceKey: z.string().min(1).max(128) })).mutation(({ ctx, input }) => createDevicePairing(ctx.user.id, input)),
      confirmPairing: protectedProcedure.input(z.object({ token: z.string().min(1) })).mutation(({ ctx, input }) => confirmDevicePairing(ctx.user.id, input.token)),
      revoke: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => revokeConnectedDevice(ctx.user.id, input.id)),
    }),
    voice: router({
      sync: protectedProcedure
        .input(
          z.object({
            audioBase64: z.string().min(1),
            mimeType: z.string().regex(/^audio\//),
            durationMs: z.number().int().nonnegative().max(15 * 60 * 1000).optional(),
            language: z.string().min(2).max(12).optional(),
          }),
        )
        .mutation(({ ctx, input }) => syncVoiceNote(ctx.user.id, input)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
