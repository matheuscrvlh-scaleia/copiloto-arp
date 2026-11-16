-- Todo usuário novo em auth.users ganha o perfil em core.usuarios.
create trigger criar_usuario after insert on auth.users
  for each row execute function core.criar_usuario();
