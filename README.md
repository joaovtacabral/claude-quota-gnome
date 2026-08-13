# Claude Code Quota Monitor

Extensão do GNOME Shell que exibe o uso de tokens do [Claude Code](https://claude.ai/code) com uma barra de progresso na barra superior.

## O que exibe

**Na barra superior:**
- `[ícone] 32.2K` — tokens usados hoje (entrada + saída)
- `[ícone] 32.2K [1]` — com uma sessão do Claude Code ativa

**Ao clicar:**

```
── Uso de Tokens Hoje ─────────────────
  32.2K / 500K tokens          6%
  [████░░░░░░░░░░░░░░░░░░░░░░░░]

── Detalhes ───────────────────────────
  Entrada:        0.1K
  Saída:          32.2K
  Cache lido:     1.2M
  Prompts hoje:   12
  Sessões ativas: 1

── Último prompt ───────────────────────
  há 5m
  "adicionar barra de progresso ao uso de tokens"
```

A barra de progresso fica **amarela** aos 60% e **vermelha** aos 80% do limite diário.

## Requisitos

- GNOME Shell 45, 46 ou 47
- [Claude Code](https://claude.ai/code) instalado e usado ao menos uma vez

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

## Configurar o limite diário de tokens

Abra as preferências para definir seu orçamento diário de tokens (padrão: 500 000):

```bash
gnome-extensions prefs claude-quota@monitor
```

Ou acesse **Configurações → Extensões → Claude Code Quota Monitor → Preferências**.

## Como funciona

Lê o uso de tokens diretamente de `~/.claude/projects/**/*.jsonl` — os mesmos arquivos que o Claude Code usa para armazenar o histórico de conversas. Não requer chave de API nem conexão com a internet.

Atualiza a cada 60 segundos.

## Ícone

O ícone na barra é o `claude-code.svg`, incluído junto com a extensão e carregado diretamente do disco — sem depender do tema de ícones do sistema. Para substituí-lo, basta trocar o arquivo `claude-code.svg` no diretório da extensão (`~/.local/share/gnome-shell/extensions/claude-quota@monitor/`) por outro SVG com o mesmo nome e reiniciar o GNOME Shell.

## Licença

MIT
