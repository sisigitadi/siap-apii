import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { IncomingLettersController } from './incoming-letters.controller';
import { LettersService } from './letters.service';
import { LettersPdfService } from './letters-pdf.service';
import { IncomingLettersService } from './incoming-letters.service';

@Module({
  controllers: [LettersController, IncomingLettersController],
  providers: [LettersService, LettersPdfService, IncomingLettersService],
  exports: [LettersService, LettersPdfService, IncomingLettersService],
})
export class LettersModule {}
