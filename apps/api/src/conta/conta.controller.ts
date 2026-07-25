import { Controller, Delete, Get, UseGuards } from "@nestjs/common";
import type { JwtPayload } from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ContaService } from "./conta.service";

@Controller("conta")
@UseGuards(AuthGuard)
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  /** Alimenta a tela de confirmação: o usuário precisa saber o que perde. */
  @Get("exclusao/previa")
  previa(@CurrentUser() user: JwtPayload) {
    return this.conta.previa(user);
  }

  @Delete()
  excluir(@CurrentUser() user: JwtPayload) {
    return this.conta.excluir(user);
  }
}
