import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsString, IsOptional, IsInt, Min, IsBoolean, MaxLength } from 'class-validator';

import { Roles } from '../auth/decorators/roles.decorator';
import { RoomsService } from './rooms.service';

class CreateRoomDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** GET /rooms — список кабинетов (персонал: выбор при апруве/назначении). */
  @Get()
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll() {
    return this.rooms.findAll();
  }

  /** POST /rooms — создать кабинет (ADMIN+). */
  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto.name, dto.capacity ?? null);
  }

  /** PATCH /rooms/:id — переименовать/вместимость/вкл-выкл (ADMIN+). */
  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.update(id, dto);
  }
}
