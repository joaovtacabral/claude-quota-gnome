# Claude Code Quota Monitor

Extensão do GNOME Shell que exibe a quota real do [Claude Code](https://claude.ai/code) diretamente na barra superior, buscando os dados da API da Anthropic.

## O que exibe

<img width="311" height="379" alt="image" src="https://github.com/user-attachments/assets/4219f21f-336c-4acf-8837-6fb7d2bdc063" />

**Na barra superior:**
- Porcentagem do limite de **sessão** consumido

**Ao clicar:**
- Barras de progresso por período: sessão, diário, semanal e mensal — cada uma com percentual, tempo até reset e cor indicativa
- Atividade local: prompts hoje, prompts na semana e sessões ativas

As barras ficam **amarelas** aos 60% e **vermelhas** aos 80%.

Ao abrir o menu, os dados são atualizados imediatamente. Enquanto consulta a API, o ícone na barra exibe uma animação de carregamento (`⠋`). Em caso de erro, a última porcentagem consultada é mantida na barra.

## Como funciona

Busca os dados reais de quota da API da Anthropic (`api.anthropic.com/api/oauth/usage`) usando o token OAuth armazenado pelo Claude Code em `~/.claude/.credentials.json`. Nenhuma chave de API manual é necessária.

Atualiza automaticamente **a cada 5 minutos** e também **sempre que o menu é aberto**.

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
