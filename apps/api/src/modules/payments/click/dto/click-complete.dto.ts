import { IsString, IsNumberString, Matches, IsOptional } from 'class-validator';

export class ClickCompleteDto {
  @IsString()
  click_trans_id!: string;

  @IsString()
  service_id!: string;

  @IsString()
  click_paydoc_id!: string;

  @IsString()
  merchant_trans_id!: string;

  @IsNumberString()
  amount!: string;

  @IsNumberString()
  action!: string;

  @IsNumberString()
  error!: string;

  @IsString()
  error_note!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, {
    message: 'sign_time must be YYYY-MM-DD HH:MM:SS',
  })
  sign_time!: string;

  @IsString()
  sign_string!: string;

  @IsOptional()
  @IsString()
  merchant_prepare_id?: string;
}
