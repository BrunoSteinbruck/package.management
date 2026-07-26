import { Module } from "@nestjs/common";
import { ExportService } from "./export.service";
import { LeiturasController } from "./leituras.controller";
import { LeiturasService } from "./leituras.service";

@Module({
  controllers: [LeiturasController],
  providers: [LeiturasService, ExportService],
})
export class LeiturasModule {}
