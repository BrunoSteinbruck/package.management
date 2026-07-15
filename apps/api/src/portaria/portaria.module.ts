import { Module } from "@nestjs/common";
import { PortariaController } from "./portaria.controller";
import { PortariaService } from "./portaria.service";

@Module({
  controllers: [PortariaController],
  providers: [PortariaService],
})
export class PortariaModule {}
