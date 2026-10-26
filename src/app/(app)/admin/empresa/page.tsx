import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { formatarCep, formatarCnpj, UFS } from "@/lib/documentos";
import { formatarDataHora } from "@/lib/formato";
import { salvarEmpresa } from "@/server/admin/acoes/empresa";
import { empresa } from "@/server/admin/dados";

export const metadata: Metadata = { title: "Empresa" };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Empresa"
        description="Identificação da empresa usada nas telas e, depois, nos relatórios exportados."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.empresa">
          <Dados />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Dados() {
  const e = await empresa();
  if (!e) return null;
  const local = [e.cidade, e.uf].filter(Boolean).join(" / ");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <section className="destaque flex flex-col gap-6 rounded-[2rem] p-6 xl:col-span-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#fff] text-[#111]">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-[rgb(255_255_255/0.60)]">
              Como aparece no sistema
            </p>
            <p className="truncate text-2xl font-semibold">{e.nome}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-[rgb(255_255_255/0.80)]">
            {e.razao_social ?? "Razão social não informada"}
          </p>
          <p className="mt-1 font-mono text-xs text-[rgb(255_255_255/0.60)]">
            {e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : "CNPJ não informado"}
          </p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {[
            {
              chave: "endereco",
              Icone: MapPin,
              valor: [e.endereco, local, formatarCep(e.cep)]
                .filter(Boolean)
                .join(" · "),
            },
            { chave: "email", Icone: Mail, valor: e.email },
            { chave: "telefone", Icone: Phone, valor: e.telefone },
            { chave: "site", Icone: Globe, valor: e.site },
          ].map(({ chave, Icone, valor }) => (
            <li
              key={chave}
              className="ladrilho flex items-center gap-3 rounded-2xl px-3 py-2.5"
            >
              <Icone
                className="size-4 shrink-0 text-[rgb(255_255_255/0.60)]"
                aria-hidden
              />
              <span
                className={`min-w-0 truncate ${valor ? "" : "text-[rgb(255_255_255/0.40)]"}`}
              >
                {valor || "Não informado"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-auto text-xs text-[rgb(255_255_255/0.40)]">
          Atualizado em {formatarDataHora(e.atualizado_em)}
        </p>
      </section>

      <FormAcao
        acao={salvarEmpresa}
        className="vidro flex flex-col gap-5 rounded-[2rem] p-6 xl:col-span-8"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={rotulo}>
            Nome curto
            <input
              name="nome"
              required
              maxLength={60}
              defaultValue={e.nome}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Razão social
            <input
              name="razao_social"
              maxLength={150}
              defaultValue={e.razao_social ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            CNPJ
            <input
              name="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              defaultValue={formatarCnpj(e.cnpj)}
              className={`${classeCampo} font-mono`}
            />
          </label>
          <label className={rotulo}>
            E-mail
            <input
              name="email"
              type="email"
              defaultValue={e.email ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Telefone
            <input
              name="telefone"
              type="tel"
              maxLength={30}
              defaultValue={e.telefone ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Site
            <input
              name="site"
              type="url"
              placeholder="https://"
              defaultValue={e.site ?? ""}
              className={classeCampo}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_6rem_9rem]">
          <label className={rotulo}>
            Endereço
            <input
              name="endereco"
              maxLength={200}
              defaultValue={e.endereco ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Cidade
            <input
              name="cidade"
              maxLength={80}
              defaultValue={e.cidade ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            UF
            <Selecao
              name="uf"
              valorInicial={e.uf ?? ""}
              placeholder="—"
              opcoes={[
                { valor: "", rotulo: "—" },
                ...UFS.map((uf) => ({ valor: uf, rotulo: uf })),
              ]}
            />
          </label>
          <label className={rotulo}>
            CEP
            <input
              name="cep"
              inputMode="numeric"
              placeholder="00000-000"
              defaultValue={formatarCep(e.cep)}
              className={`${classeCampo} font-mono`}
            />
          </label>
        </div>
      </FormAcao>
    </div>
  );
}
