# Claude Code Quota Monitor

Extensão do GNOME Shell que exibe a quota real do [Claude Code](https://claude.ai/code) diretamente na barra superior, buscando os dados da API da Anthropic.

## O que exibe

**Na barra superior:**
- `[ícone] 45%` — porcentagem do limite diário consumido
- `[ícone] 45% [1]` — com uma sessão do Claude Code ativa

**Ao clicar:**

```
── Claude Max ─────────────────────────

── Sessão ─────────────────────────────
  45.0% usado          reseta em 2h 30min
  [█████████████░░░░░░░░░░░░░░░░░]

── Diário ─────────────────────────────
  6.2% usado           reseta em 14h 10min
  [██░░░░░░░░░░░░░░░░░░░░░░░░░░░░]

── Semanal ────────────────────────────
  3.1% usado           reseta em 4d 6h
  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]

── Atividade ──────────────────────────
  Prompts hoje:    12
  Prompts semana:  47
  Sessões ativas:  1

── Último prompt ───────────────────────
  há 5min
  "atualizar o README com as últimas mudanças"
```

As barras ficam **amarelas** aos 60% e **vermelhas** aos 80%.

## Como funciona

Busca os dados reais de quota da API da Anthropic (`api.anthropic.com/api/oauth/usage`) usando o token OAuth armazenado pelo Claude Code em `~/.claude/.credentials.json`. Nenhuma chave de API manual é necessária.

Atualiza automaticamente **a cada 2 minutos** e também **sempre que o menu é aberto**.

## Requisitos

- GNOME Shell 45, 46 ou 47
- [Claude Code](https://claude.ai/code) instalado e com sessão ativa (para o token OAuth)
- `curl` instalado (padrão no Ubuntu)

## Instalação

```bash
git clone https://github.com/joaovtacabral/claude-quota-gnome.git
cd claude-quota-gnome
bash install.sh
```

Em seguida, ative a extensão:

```bash
gnome-extensions enable claude-quota@monitor
```

Ou use o app **Extensões** (disponível na Ubuntu Software) para ativá-la.

> Se o GNOME Shell não carregar a extensão, reinicie com `Alt+F2` → digite `r` → `Enter`.

## Atualizar

```bash
cd claude-quota-gnome
git pull
bash install.sh
```

Depois reinicie o GNOME Shell: `Alt+F2` → `r` → `Enter`.

## Ícone

O ícone na barra é o `claude-code.svg`, incluído junto com a extensão e carregado diretamente do disco — sem depender do tema de ícones do sistema. Para substituí-lo, basta trocar o arquivo `claude-code.svg` no diretório da extensão (`~/.local/share/gnome-shell/extensions/claude-quota@monitor/`) por outro SVG com o mesmo nome e reiniciar o GNOME Shell.

## Licença

MIT
