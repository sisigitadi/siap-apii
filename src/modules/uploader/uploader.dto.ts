import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Division } from '@prisma/client';

export const uploadResponseSchema = z.object({
  id: z.string().uuid(),
  original_name: z.string(),
  mime_type: z.string(),
  file_size: z.number().int(),
  public_url: z.string().url(),
  division: z.nativeEnum(Division).nullable(),
  created_at: z.date(),
});
export class UploadResponseDto extends createZodDto(uploadResponseSchema) {}
