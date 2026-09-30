import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UploadedFile as UploadedFileModel } from '@prisma/client';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import { UploaderService } from './uploader.service';

@ApiTags('uploader')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/uploads')
export class UploaderController {
  constructor(private readonly uploaderService: UploaderService) {}

  @Post()
  @ApiOperation({ summary: 'Unggah berkas pendukung (PDF, Gambar, Dokumen; maks 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<UploadedFileModel> {
    return this.uploaderService.uploadFile(file, user);
  }
}
