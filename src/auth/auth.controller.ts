import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterCompanyDto, RegisterUserDto, SwitchCompanyDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentCompanyId } from '../common/decorators/company.decorator';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { CompanyUserRole } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterCompanyDto) {
    return this.auth.registerCompany(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('company/switch')
  @UseGuards(JwtAuthGuard)
  switchCompany(@CurrentUserId() userId: string, @Body() dto: SwitchCompanyDto) {
    return this.auth.switchCompany(userId, dto.companyId);
  }

  @Get('companies')
  @UseGuards(JwtAuthGuard)
  getCompanies(@CurrentUserId() userId: string) {
    return this.auth.getCompanies(userId);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard, RolesGuard)
  @Roles(CompanyUserRole.OWNER, CompanyUserRole.CONTADOR)
  registerUser(
    @CurrentCompanyId() companyId: string,
    @CurrentUserId() invitedById: string,
    @Body() dto: RegisterUserDto,
  ) {
    return this.auth.registerUser(companyId, dto, invitedById);
  }
}
