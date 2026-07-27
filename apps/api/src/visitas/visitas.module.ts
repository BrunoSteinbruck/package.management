import { Module } from "@nestjs/common";
import { VisitasController } from "./visitas.controller";
import { VisitasService } from "./visitas.service";

@Module({
  controllers: [VisitasController],
  providers: [VisitasService],
})
export class VisitasModule {}
