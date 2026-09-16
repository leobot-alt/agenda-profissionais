# Agenda Profissionais

Aplicação web estática para gestão de agendas, escalas e solicitações de profissionais.

## Estrutura

- `public/index.html`: aplicação publicada pelo GitHub Pages.
- `.github/workflows/static.yml`: workflow de publicação.

## Desenvolvimento local

Como a aplicação é estática, pode ser executada com qualquer servidor HTTP local. Por exemplo:

```bash
python3 -m http.server 8080 --directory public
```

Depois, abra `http://localhost:8080`.

## Deploy

Cada push para `main` publica somente o conteúdo de `public/` no GitHub Pages. O workflow também pode ser executado manualmente pela aba **Actions**.

## Segurança

A aplicação usa o cliente público do Supabase no navegador. A chave publicável não substitui as políticas de segurança do banco. Todas as tabelas acessadas pelo frontend devem ter Row Level Security (RLS) habilitado, com políticas que validem o usuário autenticado e o perfil de acesso no próprio banco.

Nunca coloque neste repositório uma chave `service_role`, senha de banco, token privado ou qualquer segredo. Antes de publicar alterações, revise arquivos adicionados ao diretório `public/`.

## Checklist antes de publicar

1. Confirmar que o frontend continua carregando em ambiente local.
2. Verificar autenticação e logout.
3. Testar leitura e gravação com perfis diferentes.
4. Confirmar as políticas RLS no Supabase.
5. Conferir os logs da execução do GitHub Actions.
