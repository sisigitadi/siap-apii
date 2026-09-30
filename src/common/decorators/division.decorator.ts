import { SetMetadata } from '@nestjs/common';
import { Division as DivisionEnum } from '@prisma/client';

export const DIVISION_KEY = 'requiredDivision';

/** Batasi endpoint ke satu divisi (isolasi mutlak, DESIGN.md §5.3) */
export const Division = (division: DivisionEnum): MethodDecorator & ClassDecorator =>
  SetMetadata(DIVISION_KEY, division);
