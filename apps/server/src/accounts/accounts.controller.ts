// POST /api/account/check: does an account have this code? Used before any connection (first launch: « J'ai déjà un
// code », « Choisir mon code ») and before switching account. Limited per IP like unknown codes.
import { Body, Controller, HttpCode, Inject, Ip, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { intents, type Ack, type IntentResults } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { UserError } from '../errors.js';
import { AccountsService } from './accounts.service.js';

@Controller('api/account')
export class AccountsController {
  constructor(@Inject(ENV) private readonly env: Env, private readonly accounts: AccountsService) {}

  @Post('check')
  @HttpCode(200)
  async check(@Body() body: unknown, @Ip() ip: string, @Req() req: Request): Promise<Ack<IntentResults['account:find']>> {
    const v = intents['account:find'].safeParse(body);
    if (!v.success) return { ok: false, error: 'Demande invalide.' };
    const from = (this.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()) || ip;
    try { return { ok: true, value: await this.accounts.find(v.data.code, from) }; } catch (e) {
      if (e instanceof UserError) return { ok: false, error: e.message };
      throw e;
    }
  }
}
