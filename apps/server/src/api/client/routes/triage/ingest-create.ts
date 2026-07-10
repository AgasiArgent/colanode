import { randomUUID } from 'crypto';

import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { TriageArtifactRef } from '@colanode/server/data/schema';
import { storage } from '@colanode/server/lib/storage';

const ingestReportSchema = z.object({
  sourceAdapter: z.string().default(''),
  title: z.string().default(''),
  reporter: z
    .object({
      id: z.string().nullable().default(null),
      name: z.string().default(''),
    })
    .default({ id: null, name: '' }),
  did: z.string().default(''),
  expected: z.string().default(''),
  got: z.string().default(''),
  pageUrl: z.string().default(''),
  pageTitle: z.string().default(''),
  pins: z.array(z.unknown()).default([]),
  debugContext: z.record(z.string(), z.unknown()).default({}),
});

const ARTIFACT_KINDS = ['screenshot', 'video', 'console'] as const;
type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'application/json': 'json',
  'text/plain': 'txt',
};

export const triageIngestRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/ingest',
    schema: {
      response: {
        200: z.object({ id: z.string() }),
        400: apiErrorOutputSchema,
        401: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      if (!request.isMultipart()) {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: 'Expected multipart/form-data',
        });
      }

      const reportId = randomUUID();
      const projectId = request.triageProject.id;
      let reportJson: string | null = null;
      const artifacts: TriageArtifactRef[] = [];

      for await (const part of request.parts()) {
        if (part.type === 'field' && part.fieldname === 'report') {
          reportJson = String(part.value);
        } else if (part.type === 'file') {
          if (!(ARTIFACT_KINDS as readonly string[]).includes(part.fieldname)) {
            part.file.resume();
            continue;
          }
          const buffer = await part.toBuffer();
          const artifactId = randomUUID();
          const ext = MIME_EXT[part.mimetype] ?? 'bin';
          const storagePath = `triage/${projectId}/${reportId}/${artifactId}.${ext}`;
          await storage.upload(storagePath, buffer, part.mimetype);
          artifacts.push({
            id: artifactId,
            kind: part.fieldname as ArtifactKind,
            contentType: part.mimetype,
            storagePath,
          });
        }
      }

      if (!reportJson) {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: 'Missing "report" multipart field',
        });
      }

      let rawReport: unknown;
      try {
        rawReport = JSON.parse(reportJson);
      } catch {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: 'The "report" field is not valid JSON',
        });
      }

      const parsed = ingestReportSchema.safeParse(rawReport);
      if (!parsed.success) {
        return reply.code(400).send({
          code: ApiErrorCode.BadRequest,
          message: `Invalid report: ${parsed.error.message}`,
        });
      }

      const report = parsed.data;
      await database
        .insertInto('triage_reports')
        .values({
          id: reportId,
          project_id: projectId,
          source_adapter: report.sourceAdapter,
          reporter_id: report.reporter.id,
          reporter_name: report.reporter.name,
          title: report.title,
          did: report.did,
          expected: report.expected,
          got: report.got,
          page_url: report.pageUrl,
          page_title: report.pageTitle,
          pins: JSON.stringify(report.pins),
          debug_context: JSON.stringify(report.debugContext),
          artifacts: JSON.stringify(artifacts),
        })
        .execute();

      return { id: reportId };
    },
  });

  done();
};
