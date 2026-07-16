import { Module } from "@nestjs/common";
import { MoradorController } from "./morador.controller";
import { MoradorService } from "./morador.service";

@Module({
  controllers: [MoradorController],
  providers: [MoradorService],
  exports: [MoradorService],
})
export class MoradorModule {}
