import { describe, expect, it } from "vitest";
import type { EventoWp } from "@/connectors/marketing/site";
import {
  decodificarHtml,
  eventoDoSite,
  eventosDoSite,
  eventosEntre,
} from "./eventos";

const post = (
  acf: EventoWp["acf"],
  extra: Partial<EventoWp> = {},
): EventoWp => ({
  id: 1,
  link: "https://www.espacoarp.com.br/evento/show/",
  title: { rendered: "Show" },
  acf,
  ...extra,
});

describe("agenda de eventos do site", () => {
  it("título sem as entidades HTML do WordPress", () => {
    expect(decodificarHtml("Exposição &#8220;Lanzieiro&#8221;")).toBe(
      "Exposição “Lanzieiro”",
    );
    expect(decodificarHtml("Mommy&#8217;n Move &amp; cia &#x2013; ok")).toBe(
      "Mommy’n Move & cia – ok",
    );
  });

  it("evento de um dia com hora de início e de fim", () => {
    const e = eventoDoSite(
      post({
        evento_tipo: "date",
        evento_data_hora: "2026-10-20 07:30:00",
        evento_data_hora_fim: "2026-10-20 19:30:00",
        evento_descricao: "Exposição no Corredor Cultural",
        evento_link: "https://www.instagram.com/espacoarp/",
      }),
    );
    expect(e).toMatchObject({
      inicio: "2026-10-20",
      fim: "2026-10-20",
      horario: "07:30 às 19:30",
      linkExterno: "https://www.instagram.com/espacoarp/",
    });
  });

  it("tipo array: vários dias, do primeiro início ao último fim", () => {
    const e = eventoDoSite(
      post({
        evento_tipo: "array",
        evento_data_hora: null,
        evento_datas: "2025-10-11 08:00:00_2025-10-19 23:00:00",
      }),
    );
    expect(e).toMatchObject({
      inicio: "2025-10-11",
      fim: "2025-10-19",
      horario: "08:00 às 23:00",
    });
  });

  it("sem data fica de fora; fim antes do início vira o próprio início", () => {
    expect(eventoDoSite(post({ evento_tipo: "date" }))).toBeNull();
    expect(eventoDoSite(post(undefined))).toBeNull();
    const e = eventoDoSite(
      post({
        evento_tipo: "date",
        evento_data_hora: "2026-11-02 14:00:00",
        evento_data_hora_fim: "2026-11-01 10:00:00",
        evento_link: "javascript:alert(1)",
      }),
    );
    expect(e).toMatchObject({ fim: "2026-11-02", horario: "14:00" });
    expect(e?.linkExterno).toBeNull();
  });

  it("imagem média do WordPress, ou a original", () => {
    const comTamanhos = eventoDoSite(
      post(
        { evento_tipo: "date", evento_data_hora: "2026-11-02 14:00:00" },
        {
          _embedded: {
            "wp:featuredmedia": [
              {
                source_url: "https://x/original.jpg",
                media_details: {
                  sizes: { medium_large: { source_url: "https://x/768.jpg" } },
                },
              },
            ],
          },
        },
      ),
    );
    expect(comTamanhos?.imagem).toBe("https://x/768.jpg");
    const semImagem = eventoDoSite(
      post({ evento_tipo: "date", evento_data_hora: "2026-11-02 14:00:00" }),
    );
    expect(semImagem?.imagem).toBeNull();
  });

  it("ordena por data e filtra o intervalo", () => {
    const lista = eventosDoSite([
      post(
        { evento_tipo: "date", evento_data_hora: "2026-11-05 10:00:00" },
        { id: 2 },
      ),
      post(
        {
          evento_tipo: "array",
          evento_datas: "2026-10-28 08:00:00_2026-11-03 18:00:00",
        },
        { id: 3 },
      ),
      post({ evento_tipo: "date" }, { id: 4 }),
    ]);
    expect(lista.map((e) => e.id)).toEqual([3, 2]);
    expect(
      eventosEntre(lista, "2026-11-01", "2026-11-04").map((e) => e.id),
    ).toEqual([3]);
  });
});
