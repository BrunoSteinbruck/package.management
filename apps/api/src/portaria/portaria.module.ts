import { Module } from "@nestjs/common";
import { OcrService } from "../ocr/ocr.service";
import { PortariaController } from "./portaria.controller";
import { PortariaService } from "./portaria.service";

@Module({
  controllers: [PortariaController],
  providers: [PortariaService, OcrService],
})
export class PortariaModule {}
