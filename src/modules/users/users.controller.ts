import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserDto } from '@/common/dto/user.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AccessTokenClaims } from '@/infrastructure/jwt/jwt.service';
import {
  InviteUserDto,
  ListUsersQueryDto,
  UpdateDelegationDto,
  UpdateUserRoleDto,
  UserListDto,
  type UserList,
} from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Pengguna')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Peran tidak diizinkan atau tidak punya delegasi' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('SUPERADMIN', 'KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA', 'DEWAN_PENGAWAS')
  @ApiOperation({ summary: 'Daftar pengguna dengan paginasi & filter' })
  @ApiOkResponse({ type: UserListDto, description: 'Daftar pengguna terpaginasi' })
  async list(@Query() query: ListUsersQueryDto): Promise<UserList> {
    return this.users.list(query);
  }

  @Post('invite')
  @Roles('SUPERADMIN', 'KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA')
  @ApiOperation({ summary: 'Undang pengurus baru via email Google (FR-AUTH-04)' })
  @ApiOkResponse({ type: UserDto })
  async invite(
    @Body() body: InviteUserDto,
    @CurrentUser() actor: AccessTokenClaims,
  ): Promise<UserDto> {
    return this.users.invite(body, actor);
  }

  @Patch(':id/role')
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Ubah peran & divisi pengguna (FR-AUTH-07)' })
  @ApiOkResponse({ type: UserDto })
  async updateRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @CurrentUser() actor: AccessTokenClaims,
  ): Promise<UserDto> {
    return this.users.updateRole(id, body, actor);
  }

  @Patch(':id/delegation')
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Atur delegasi pengelolaan anggota (FR-AUTH-03)' })
  @ApiOkResponse({ type: UserDto })
  async updateDelegation(
    @Param('id') id: string,
    @Body() body: UpdateDelegationDto,
    @CurrentUser() actor: AccessTokenClaims,
  ): Promise<UserDto> {
    return this.users.updateDelegation(id, body.canManageUsers, actor);
  }
}
