import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CriarDocumentoDto,
  CriarDocumentoSchema,
  JwtPayload,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { DocumentosService } from "./documentos.service";

@Controller()
@UseGuards(AuthGuard)
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Post("cadastro/documentos")
  criar(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarDocumentoSchema)) dto: CriarDocumentoDto,
  ) {
    return this.documentos.criar(user, dto);
  }

  @Get("cadastro/documentos")
  listarGestor(@CurrentUser() user: JwtPayload) {
    return this.documentos.listarGestor(user);
  }

  @Delete("cadastro/documentos/:id")
  remover(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.documentos.remover(user, id);
  }

  @Get("morador/documentos")
  listarMorador(@CurrentUser() user: JwtPayload) {
    return this.documentos.listarMorador(user);
  }
}
