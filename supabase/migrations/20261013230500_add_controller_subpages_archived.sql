-- Arquivamento reversível das áreas do Controller; os atendimentos vinculados são preservados.
alter table public.controller_subpages
  add column if not exists arquivada boolean not null default false;
