import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

@Controller('config')
export class ConfigAppController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('exchange-rate')
  getExchangeRate() {
    const uzsPerUsd = Number(this.config.get<string>('USD_RATE') ?? '12500');
    return { uzs_per_usd: uzsPerUsd };
  }
}
