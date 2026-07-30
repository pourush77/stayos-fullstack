import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestEntity } from './infrastructure/guest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GuestEntity]), PropertiesModule],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
