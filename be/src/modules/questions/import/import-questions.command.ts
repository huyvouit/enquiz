import { CommandHandler, ICommandHandler, Command } from '@nestjs/cqrs';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthUser } from '../../../common/types/auth-user.js';
import {
  ImportReport,
  QuestionImportService,
} from './question-import.service.js';
import { CSV_COLUMNS } from './question-row.js';

export class ImportQuestionsDto {
  /** The CSV file's text (the browser reads the file; UTF-8). */
  @IsString()
  @MinLength(1)
  @MaxLength(2_000_000)
  csv: string;
}

/** dryRun: validate and report only; nothing is written. */
export class ImportQuestionsCommand extends Command<ImportReport> {
  constructor(
    public readonly csv: string,
    public readonly dryRun: boolean,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

@CommandHandler(ImportQuestionsCommand)
export class ImportQuestionsHandler implements ICommandHandler<ImportQuestionsCommand> {
  constructor(private readonly importer: QuestionImportService) {}

  async execute({
    csv,
    dryRun,
    user,
  }: ImportQuestionsCommand): Promise<ImportReport> {
    return (await this.importer.import(csv, user, dryRun)).report;
  }
}

/** Template offered for download: header + one example of each type. */
export const CSV_TEMPLATE =
  '﻿' +
  [
    CSV_COLUMNS.join(','),
    'multiple_choice,Animals,1,vocabulary,🐶 What animal is this?,Dog|Cat|Duck,Dog,,,,Dog = con chó,pets,starters,Unit 1,,,',
    'fill_in_blank,Animals,2,vocabulary,I have a ___.,cat|fish|sun,cat|kitten,,,,,pets,starters,,,,',
    'ordering,Family,3,grammar,Sắp xếp thành câu đúng,,I|love|my|mum,,,,,,movers,,,,',
    'matching,Colors,1,vocabulary,Nối màu với từ,,,🔴=red|🟢=green|🔵=blue,,,,,starters,,,,',
    'multiple_choice,Animals,1,listening,Nghe và chọn con vật đúng,🦆|🐔,🦆,,a duck,,,farm,starters,,,,',
  ].join('\r\n') +
  '\r\n';
