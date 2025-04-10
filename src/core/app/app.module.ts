import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from '../../middleware/LoggerMiddleware';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { DevicesModule } from '../devices/devices.module';
import { DevicesService } from '../devices/devices.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        global: true,
        secret: process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, UsersService, AuthService, DevicesService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*'); // Áp dụng cho tất cả các routes
  }
}
