import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/** Rejects route params that are not valid MongoDB ObjectIds with a 400. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`ID không hợp lệ: ${value}`);
    }
    return value;
  }
}
