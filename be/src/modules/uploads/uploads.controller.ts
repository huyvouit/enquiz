import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { serveFile, type StoredUpload, uploadToDisk } from '@nestjs/storage';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { AUDIO_KEY_PATTERN, AudioStorageService } from './audio-storage.js';
import {
  IMAGE_TYPES,
  IMAGES_DISK,
  ImageStorageService,
  MAX_IMAGE_BYTES,
} from './image-storage.service.js';

/** Keys are "<uuid>.<ext>": nothing else is ever served. */
const KEY_PATTERN = /^[0-9a-f-]{36}\.(png|jpe?g|webp)$/;

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly images: ImageStorageService,
    private readonly audio: AudioStorageService,
  ) {}

  /**
   * POST /uploads/images (multipart, field "file").
   * The real type is detected from the file signature (not its name):
   * other types -> 415, larger than 1 MB -> 413.
   */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadToDisk({
        disk: IMAGES_DISK,
        contentTypes: IMAGE_TYPES,
        cacheControl: 'public, max-age=31536000, immutable',
      }),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  upload(@UploadedFile() file: StoredUpload | undefined) {
    if (!file) throw new BadRequestException('Hãy chọn một ảnh để tải lên');
    return {
      key: file.key,
      url: this.images.publicUrl(file.key),
      contentType: file.contentType,
      size: file.size,
    };
  }

  /** Serves local uploads (S3 serves its own public URLs). */
  @Public()
  @Get('images/:key')
  serve(
    @Param('key') key: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.images.isLocal || !KEY_PATTERN.test(key)) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
    return serveFile(this.images.disk, key, {
      req,
      res,
      disposition: 'inline',
    });
  }

  /** Serves local listening audio made by text-to-speech (plan D16). */
  @Public()
  @Get('audio/:key')
  serveAudio(
    @Param('key') key: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.audio.isLocal || !AUDIO_KEY_PATTERN.test(key)) {
      throw new NotFoundException('Không tìm thấy âm thanh');
    }
    return serveFile(this.audio.disk, key, {
      req,
      res,
      disposition: 'inline',
    });
  }
}
