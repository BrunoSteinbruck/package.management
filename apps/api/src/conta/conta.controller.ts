import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import {
  AlterarEmailSchema,
  AlterarSenhaSchema,
  type AlterarEmailDto,
  type AlterarSenhaDto,
  type JwtPayload,
} from "@pacotes/shared";
import { ZodPipe } from "../common/zod.pipe";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ContaService } from "./conta.service";

@Controller("conta")
@UseGuards(AuthGuard)
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  /** Módulos ligados para esta sessão; o app chama ao abrir. */
  @Get("capacidades")
  capacidades(@CurrentUser() user: JwtPayload) {
    return this.conta.capacidades(user);
  }

  /** Alimenta a tela de confirmação: o usuário precisa saber o que perde. */
  @Get("exclusao/previa")
  previa(@CurrentUser() user: JwtPayload) {
    return this.conta.previa(user);
  }

  @Delete()
  excluir(@CurrentUser() user: JwtPayload) {
    return this.conta.excluir(user);
  }

  /** Vale para morador e equipe: quem perde o telefone é qualquer um. */
  @Post("sair-outros-aparelhos")
  sairDosOutrosAparelhos(@CurrentUser() user: JwtPayload) {
    return this.conta.sairDosOutrosAparelhos(user);
  }

  // ---------- conta do gestor (painel) ----------

  @Get("perfil")
  minhaConta(@CurrentUser() user: JwtPayload) {
    return this.conta.minhaConta(user);
  }

  @Post("senha")
  alterarSenha(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(AlterarSenhaSchema)) body: AlterarSenhaDto,
  ) {
    return this.conta.alterarSenha(user, body);
  }

  @Post("email")
  alterarEmail(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(AlterarEmailSchema)) body: AlterarEmailDto,
  ) {
    return this.conta.alterarEmail(user, body);
  }
}
