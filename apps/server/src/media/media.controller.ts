// POST /api/media (the file as the body, `X-Ticket` from the WebSocket) and GET /media/:id (the stored picture,
// cached for good: a picture never changes under its address).
import { Controller, Get, Headers, HttpCode, NotFoundException, Param, Post, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { UploadResult } from '@slopesque/shared';
import { UserError } from '../errors.js';
import { MediaService } from './media.service.js';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('api/media')
  @HttpCode(200)
  async upload(@Headers('x-ticket') ticket: string | undefined, @Req() req: Request): Promise<UploadResult> {
    try {
      const row = await this.media.upload(ticket ?? '', Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      return { ok: true, value: { id: row.id, url: this.media.url(row.id), w: row.width, h: row.height } };
    } catch (e) {
      if (e instanceof UserError) return { ok: false, error: e.message };
      throw e;
    }
  }

  @Get('media/:id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const row = await this.media.get(id.replace(/\.webp$/, ''));
    if (!row) throw new NotFoundException();
    let body: NodeJS.ReadableStream;
    try { body = await this.media.stream(row); } catch { throw new ServiceUnavailableException('Images indisponibles pour le moment.'); }
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    body.pipe(res);
  }
}
