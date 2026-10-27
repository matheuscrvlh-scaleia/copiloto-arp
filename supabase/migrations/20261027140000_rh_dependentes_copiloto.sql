-- Dependentes vêm do Copiloto RH (GET /v1/dependents, a aba Dependentes do
-- perfil), como as pessoas: a sincronização grava e tira quem sumiu de lá.
-- tem_plano é a marca "Dependente de Plano de Saúde" do Copiloto; tem_odonto
-- não existe lá e fica como está. Nenhuma tela cadastrava dependente, então o
-- que houver sem copiloto_id sai.

alter table rh.dependentes
  add column copiloto_id uuid unique,
  -- Como o Copiloto mostra: Filho(a), Cônjuge / Companheiro(a), Pai / Mãe ou
  -- a descrição de "Outro".
  add column parentesco text;

delete from rh.dependentes where copiloto_id is null;
alter table rh.dependentes alter column copiloto_id set not null;

-- Só a sincronização grava (service role); a tela só lê.
drop policy editar on rh.dependentes;
revoke insert, update, delete on rh.dependentes from authenticated;
