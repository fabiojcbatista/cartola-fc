# Superliga do Fabião — Cartola FC

## Como executar

1. Instale o **Node.js 18 ou superior**.
2. Extraia esta pasta para seu computador.
3. Abra o terminal dentro da pasta `superliga_fabiao`.
4. Execute:

   ```bash
   node server.js
   ```

5. Abra no navegador: http://localhost:3000

O `server.js` funciona como intermediário entre a página e a API pública do Cartola FC, evitando que o navegador tente acessar a API diretamente e seja bloqueado por CORS.

## Como publicar na NUVEM (Render) — a partir da v29

O painel funciona publicado na internet (ex.: https://superliga-fabiao.onrender.com). Passos:

1. Coloque os 4 arquivos desta pasta (server.js, index.html, package.json, README.txt) num
   repositório GitHub (ou use o deploy direto do Render por arquivo zip, se preferir).
2. No Render: **New → Web Service**, conecte o repositório.
3. Runtime **Node**; Build command pode ficar vazio (não há dependências); Start command:
   `node server.js` (ou apenas aceite o `npm start` do package.json).
4. Nenhuma variável de ambiente é obrigatória: a v29 detecta a nuvem sozinha (a plataforma define
   `PORT`) e passa a ouvir em `0.0.0.0` — antes era preciso definir `HOST=0.0.0.0` à mão.

O que muda no plano gratuito (a instância HIBERNA após ~15 min sem acesso e acorda sozinha no
próximo acesso, com a memória limpa):

- **A sessão NÃO morre mais com a hibernação (v29)**: o painel guarda uma cópia de reserva da
  credencial no armazenamento local do SEU navegador; quando o servidor acorda sem memória, o
  painel a reenvia (`POST /auth/restaurar`), o servidor revalida na API do Cartola (renovando
  com o refresh_token) e recria a sessão. Você nem percebe. A cópia sai do navegador no Sair.
- **Primeira carga após hibernar demora até ~1 minuto**: o painel avisa “Acordando o servidor na
  nuvem…” — é uma vez só; com a aba aberta, o painel mantém a instância acordada (toque leve a
  cada 5 min).
- **Login na nuvem**: o modo AUTOMÁTICO (Chrome controlado) é um recurso LOCAL — o servidor da
  nuvem não tem Chrome nem tela, e o painel cai sozinho no MODO MANUAL: janela comum do navegador
  (Google/Facebook funcionam nela), você entra, copia o endereço final (Ctrl+L, Ctrl+C) e volta
  ao painel — a conclusão é automática (leitura da área de transferência). No celular: segure a
  barra de endereço → Copiar, volte ao painel e cole no campo (iOS não deixa o painel ler a
  área de transferência sozinho; o campo “Concluir login” resolve).
- **Privacidade**: a cópia de reserva fica só no navegador de quem usa o painel (não vai para
  disco do servidor); o painel não carrega nenhum script de terceiros. O Sair revoga o
  refresh_token na Globo e apaga a cópia — em qualquer dispositivo que usar depois, a sessão
  antiga deixa de valer.

## Novidades da versão 39 — MÉDIA DO TIME SELECIONADO em LINHA RETA

Correção na média dos gráficos (individual e unificado):

- A média deixa de ser a média dos times monitorados rodada a rodada (v38) e passa a ser a
  média DO TIME SELECIONADO: pontuação total ÷ rodadas finalizadas (a mesma pontuação exibida
  na tabela — soma de todas as rodadas já disputadas, com o parcial da rodada em andamento;
  se alguma rodada falhou ao carregar, divide pelas rodadas realmente pontuadas).
- A média é desenhada como LINHA RETA horizontal VERDE atravessando os DOIS gráficos.
- O NÚMERO aparece EM DESTAQUE numa pílula verde dentro do gráfico (“média 75,22”) — no
  individual ela fica com resguardo para nunca cobrir a pílula de ouro do último ponto.
- Ao selecionar outro time (cartão, tabela, card da lista, linha ou chip da legenda), a
  média e a altura da linha mudam junto: o número passa a ser a média do time selecionado.
- A legenda continua com o chip “média” (agora com título explicando a fórmula) e a dica do
  card explica a nova regra.

## Novidades da versão 38 — GRÁFICO UNIFICADO + MÉDIA EM VERDE

O card de pontuação agora tem DOIS gráficos, na MESMA janela do seletor “Rodadas exibidas”:

- “Desempenho por rodada” (individual, do time selecionado — v34/v35) e o novo
  “Todos os times (unificado)”: todas as linhas monitoradas no mesmo desenho, em SVG puro.
- NO UNIFICADO, o time SELECIONADO fica em destaque (linha dourada grossa com marcador);
  os demais ficam finos e discretos. Clicar numa LINHA ou num CHIP da legenda seleciona o
  time — o gráfico individual passa a mostrá-lo e a linha dele volta ao destaque (mesma
  rota do v35: cartões do topo, cards da lista e células da tabela continuam valendo).
- MÉDIA EM VERDE: os DOIS gráficos exibem a média dos times monitorados em cada rodada,
  tracejada em verde — a comparação com o time é imediata. Com 1 time só, a média não
  aparece (seria o próprio time) e o subtítulo explica a regra.
- Legenda clicável com chips coloridos (um por time + chip “média”), badge “meu time” e
  dica atualizada citando todas as rotas de seleção.

## Novidades da versão 37 — REDESIGN DE LEGIBILIDADE (feedback de UI/UX)

“O layout é funcional… porém sofre com excesso de cabeçalhos redundantes e densidade visual”
— cada ponto do review foi aplicado, sem mexer em NADA da mecânica (v30–v36 intactas):

- CABEÇALHOS UNIFICADOS: a barra duplicada “Lista de times monitorados” e o cabeçalho
  repetido da pontuação saíram — cada bloco fica com UM título (o do próprio fold). O
  cabeçalho fino das ligas (“Ligas Clássicas (suas ligas no Cartola)”) permanece, com o
  link “Classificação oficial”.
- LIGAS CLÁSSICAS EM CARDS: a tabela rígida de 10 colunas virou lista de cartões
  respiráveis — nome + descrição à esquerda, “👑 Líder: …” e “Dif. p/ líder: …” MANTIDOS
  (como pedido), e à direita “times | posição “Xº de N” | Pontos” com divisores finos.
  Listras alternadas sutis; a liga do seu time ganha contorno azul. Turno/Mês/Rodada
  (rankings nacionais) saíram do card para dar respiro — os dados seguem na API.
- NÚMEROS COM SEPARADOR DE MILHAR (formatInt): 1991563 → 1.991.563 e 54608º → 54.608º.
  O “ordinal” foi reescrito sobre o formatInt — vale para clássicas, mata-mata e PC.
- LISTA DE TIMES EM CARDS: grid claro com escudo, PONTO de status (verde “Conectado”,
  âmbar carregando, vermelho falha), badge “meu time” e toque que seleciona o time no
  gráfico (mesma rota do cartão do topo e da célula na tabela). O card do time escolhido
  ganha contorno azul.
- ÍCONES VETORIAIS na navegação inferior: casa, pessoas, troféu e barras em SVG de traço
  fino (sem emoji nativo), mantendo o destaque dourado do item ativo.

Nota técnica: as baterias antigas de mata-mata (v14/v15/knockout) foram reajustadas para
o mecanismo atual — as colunas de rodadas seguem a JANELA exibida desde a v30 (1..N) e a
fase da eliminação vem do CHAVEAMENTO REAL/observação ao vivo desde a v15 (posição e
J/V/E/D como fonte foram aposentadas). A bateria v13 foi arquivada (suplantada pelas
baterias v14+; quebrava desde a v14 pelos filtros de ligas alheias).

## Novidades da versão 36 — O CARTÃO DO MEU TIME PARA TODOS (a pedido)

“O gráfico que tem no time logado, quero ele nos times pesquisados também” — feito:

- TIMES PESQUISADOS GANHAM O MESMO CARTÃO DO MEU TIME no topo: escudo (da API do Cartola),
  nome, total de pontos, situação do mercado e a SPARKLINE das últimas 10 rodadas — em azul,
  para não disputar com o ouro do Meu time. O chip pequeno que existia antes foi aposentado.
- FUNCIONA SEM LOGIN: buscando um time pelo nome, o cartão aparece já com o histórico
  carregado (endpoints públicos da API), junto do cartão fantasma “Entre com a Globo”.
- O CARTÃO É CLICÁVEL: um toque nele e o gráfico “Desempenho por rodada” passa a mostrar
  esse time (mesma rota do clique na tabela, v35). O cartão do time escolhido ganha um
  contorno azul; a dica abaixo do gráfico agora cita as duas rotas (tabela e cartão).
- O CARTÃO DO MEU TIME FICA INTOCATO: dourado, sparkline âmbar, contagem animada (v33)
  e sem clique — o destaque continua sendo do seu time.

## Novidades da versão 35 — GRÁFICO COMPLETO E SEU (a pedido)

Três mudanças na tela, zero mudança na mecânica (baterias v27/v28/v30/v31/v32 + v34/v35
passando; a regra das rodadas v30, o seletor v31 e tudo das v32/v33/v34 segue intocado):

- CARD “SEU TIME • 3 MODALIDADES — Uma só Superliga!” REMOVIDO a pedido: a lista de times
  agora emenda direto na seção das Ligas.
- PONTUAÇÕES AO LADO DE TODOS OS PONTOS: o gráfico “Desempenho por rodada” agora rotula
  CADA rodada com o valor (antes, só quando a janela era curta). Na janela completa as
  pílulas alternam acima/abaixo e arredondam para caber (ex.: 71, 47…); a ÚLTIMA rodada
  continua com a pílula de OURO e as casas decimais (ex.: 111,59). No celular os rótulos
  ficam em texto puro e o eixo X mostra rodadas alternadas — legível em tela estreita.
- O GRÁFICO SEGUE O TIME SELECIONADO: o NOME de cada time na tabela de pontuação ficou
  clicável — um toque e o desenho passa a mostrar esse time, com o escudo no cabeçalho do
  gráfico, o nome no subtítulo (“(meu time)” quando for o seu) e a linha do time escolhido
  destacada em azul na tabela. Clicar de volta no Meu time restaura; a dica “💡 Toque no
  nome de um time…” só aparece quando existem 2+ times. Recarregar a página volta ao Meu
  time (a escolha não é persistida de propósito).

## Novidades da versão 34 — DESIGN DO MOCKUP APROVADO + ESCUDO DA API + GRÁFICO POR RODADA

O painel vestiu a roupa do mockup aprovado e ganhou dois pedidos de fora: o escudo do time
logado vem pelo link que a própria API devolve, e a pontuação por rodada virou gráfico.
Por dentro, a mecânica não mudou UMA linha: regra das rodadas (v30), seletor “Rodadas
exibidas” (v31), estado inicial/menu Avançado/skeletons (v32), logo/mini-barra/navegação
inferior (v33), Sair que limpa tudo (v28) e reserva de sessão da nuvem (v29) — tudo intacto
(baterias v27/v28/v30/v31/v32 passando: 224 verificações; + 20 verificações novas da v34).
Por fora, o que mudou:

- PALETA DO MOCKUP: azul-marinho de estádio no topo (com luzes), OURO nos números e no
  cartão do Meu time, LARANJA na ação principal (Entrar com Globo, Buscar, concluir), FABIÃO
  em ouro no título e subtítulo em itálico.
- ESCUDO DO MEU TIME PELA API: o crest do cartão de ouro agora é carregado pelo LINK que a
  API do Cartola devolve para o time (foto_trofeu; reservas: url_escudo_png e o escudo do
  clube). Se o link não carregar, entra o escudo da Superliga — o cartão nunca fica sem cara.
- GRÁFICO “DESEMPENHO POR RODADA”: a seção de pontuação ganhou o gráfico de linha do Meu
  time em SVG puro (sem biblioteca) — mesma janela do seletor (v31), valor de cada rodada em
  pílulas claras e a ÚLTIMA em OURO, grade suave e rodadas no eixo. Com muitas rodadas na
  janela, só a última pílula fica (sem sopa de letras). Sem Meu time (ou com menos de 2
  rodadas na janela), uma orientação aparece no lugar — nada é inventado. E a pílula “ver
  detalhes” no acordeão abre a seção.
- CABEÇALHO DO MOCKUP: avatar + ponto verde “Conectado como …” + botão Sair branco; métricas
  viraram cartões navy com ícone (👥 📅 🏆) e número em ouro; “Rodadas do campeonato”.
- BUSCA DO MOCKUP: lupa dentro do campo + botão Buscar laranja (compacto no celular — quem
  estica é o campo).
- BANNERS NAVY: “Times cadastrados” virou barra marinho com contador dourado; o selo “SEU
  TIME • 3 MODALIDADES” ganhou bola decorativa; navegação inferior marinho com o item ativo
  em ouro e sublinhado; mini-barra de rolagem na mesma família.
- STATUS VERDE COM CHECK: a mensagem “Conexão concluída…” ganhou o selo ✓ verde do mockup.

## Novidades da versão 33 — NOVO DESIGN “IDENTIDADE DO ESCUDO” (+ logo oficial)

O painel vestiu as cores do próprio escudo e ganhou o emblema verdadeiro. Por dentro, a mecânica
não mudou UMA linha: regra das rodadas (v30), seletor “Rodadas exibidas” (v31), estado inicial
amigável, menu “Avançado”, login em 3 passos e skeletons (v32), Sair que limpa tudo (v28) e a
reserva de sessão da nuvem (v29) — tudo intacto (as baterias v27/v28/v30/v31/v32 continuam
passando, 224 verificações). Por fora, o que mudou:

- LOGO OFICIAL: o escudo (verde/ouro/azul/laranja) agora é o rosto do painel — no cabeçalho, no
  convite inicial, no favicon e na mini-barra. Embutido no próprio index.html (nenhum arquivo
  extra para distribuir).
- PALETA DO ESCUDO: verde profundo do escudo no cabeçalho e na identidade; OURO da borda nos
  números e destaques (pontuação, posição, selos); AZUL da fita nos links; LARANJA da camisa na
  ação principal (entrar, buscar, concluir). Cada modalidade mantém a sua cor (Clássicas = azul,
  Mata-Mata = verde, Pontos Corridos = roxo, Pontuação por rodada = âmbar).
- MINI-BARRA DE ROLAGEM: ao descer a página, uma barra compacta (escudo + nome + situação +
  Entrar/Sair) desce do topo — o contexto e o atalho de login/logout nunca saem de vista.
- NAVEGAÇÃO INFERIOR no celular: Início · Times · Ligas · Rodadas — um toque abre e rola até a
  seção (respeita a área de gestos do iPhone — safe-area).
- BUSCA UNIFICADA: o botão “Buscar time” mora DENTRO do campo (uma linha limpa); botões com
  altura de toque de 48px e resposta de toque (escala .98).
- TABELAS LARGAS com COLUNAS FIXAS: nas tabelas de rodadas/histórico, o nº e o NOME do time
  ficam presos à esquerda enquanto as rodadas rolam horizontalmente — dá para ler a pontuação
  por rodada no celular sem perder a referência de quem é a linha.
- CARTÃO DE OURO DO MEU TIME: o banner-resumo ganhou destaque maior e uma mini-linha (sparkline)
  com as últimas 10 rodadas; o total faz uma contagem animada quando muda de valor.
- POLIMENTO GERAL: acordeões brancos com ícone de ouro e seta que gira, abas em pílulas (a ativa
  em verde), foco de teclado em ouro, tipografia Inter, cantos arredondados e sombras suaves,
  linhas zebradas nas tabelas — tudo respeitando prefers-reduced-motion.

## Novidades da versão 32 — A PAINEL FÁCIL (mockup aprovado, implementado)

A mecânica é a mesma da v31; a experiência seguiu o mockup aprovado (síntese das sugestões de
Claude, ChatGPT, Gemini e Grok):

1. **Estado inicial amigável** — em vez de uma página que “parece quebrada”, um convite: troféu,
   “Bem-vindo ao Superliga do Fabião!”, UM botão grande **Entrar com Globo** + **Buscar um time**
   e a nota **“Seu login é seguro: acontece na página oficial da Globo — o painel recebe só uma
   chave de acesso e nunca vê a sua senha.”** O convite sai da cena assim que existe time na lista.
2. **Menu “Avançado”** — o **modo manual** e os **dados brutos da API** saíram da vista principal
   e agora moram no menu Avançado (com aria-expanded; fecha com clique fora ou Escape). Quando o
   Google/Facebook é bloqueado na janela controlada, o próprio menu pisca em amarelo e abre
   sozinho — impossível não achar.
3. **Login em 3 passos (assistente)** — o mural de instruções do diálogo manual virou um stepper
   visual com barra de progresso: **1. A janela da Globo abriu → 2. Você entra na Globo → 3. O
   painel conclui sozinho**, com textos curtos e a nota **“O que é compartilhado?”** (o login é
   todo no site da Globo; nenhuma senha passa pelo painel; o acesso é revogado no Sair). As
   instruções longas ficam em **“Instruções detalhadas e problemas comuns”**.
4. **Progresso visual do login automático** — enquanto o Chrome controlado trabalha, um cartão
   mostra os mesmos 3 passos (e o passo 3 fica visível até as ligas carregarem), com botão
   **“Cancelar o login”**.
5. **Skeleton loaders** — durante o primeiro carregamento (por exemplo, com o servidor da nuvem
   hibernando), as seções mostram linhas “brilhando” em vez de tabelas vazias; o aviso
   “Acordando o servidor na nuvem…” (v29) continua.
6. **Spinners** — “Atualizar dados” e “Buscar time” giram enquanto trabalham.
7. **Contraste e acessibilidade** — cinzas secundários mais escuros (textos em cinza claro
   ficaram legíveis ao sol), foco visível ao navegar por teclado, respeito a
   `prefers-reduced-motion` e tooltips simples (ícone “i”) com a regra de cada seção — o jargão
   completo segue nas notas de rodapé.
8. **Nada mudou na mecânica**: regra das rodadas (v30), seletor “Rodadas exibidas” (v31),
   banner-resumo, seções ocultas (folds) e o Sair que limpa tudo — intactos.

## Novidades da versão 31 — O CONTROLE DE QUAIS RODADAS EXIBIR VOLTOU

Você pediu: *“ajuste para ter de volta o controle de quais rodadas exibir.”* Feito — sem
desfazer o que a v30 trouxe:

1. **O seletor “Rodadas exibidas” está de volta** na barra superior (entre o “Buscar time” e
   o “Atualizar dados”). O padrão é **“Todas as rodadas (1–N)”** — exatamente o comportamento
   da v30. Ele também oferece **“Últimas 5 rodadas”**, **“Últimas 10 rodadas”** e janelas de
   5 em 5 **montadas a partir da rodada corrente** (1–5, 6–10, 11–15 … até a última com
   pontuação). Nada de janela fixa “34–38” cair no vazio quando a temporada está começando:
   as opções se adaptam à rodada atual toda vez que os dados são atualizados.
2. **Só a EXIBIÇÃO muda — os dados seguem sempre completos**: o painel continua buscando TODAS
   as rodadas (1 até a última com pontuação; regra da v30: com a rodada em andamento entra o
   parcial; com o mercado aberto/fechado, vale a anterior). A coluna “Pontuação” da tabela
   continua sendo a soma de TODAS as rodadas já disputadas, o banner-resumo não muda, e a
   regra da rodada continua explicada na barra de status. O seletor afeta a pontuação por
   rodada e o histórico de fase/posição nas ligas (como era antes da v30). Janela além do que
   já foi disputada mostra “—”, sem inventar número.
3. **A escolha fica guardada no navegador** (mesmo mecanismo das seções ocultas da v30):
   recarregou a página, a janela que você deixou continua. Escolha que deixa de existir (ex.:
   “31–35” quando a temporada reinicia) volta automaticamente para “Todas as rodadas”.
4. **Sem nova consulta ao trocar**: escolher uma janela só repinta as tabelas — não refaz
   nenhuma chamada à API do Cartola.

## Novidades da versão 30 — MOBILE/WEB: o essencial no banner, o resto oculto + TODAS as rodadas

Você pediu: *“prepare uma versão para mobile/web; as informações de times cadastrados e Meu
time poderiam estar no banner inicial e outras informações poderiam ser ocultas. Altere para
sempre trazer todas as rodadas; e na pontuação por rodada, a atual deve ser até a que está em
andamento — se o mercado estiver aberto, trazer até a anterior.”* Três mudanças, todas feitas:

1. **O essencial subiu para o BANNER (mobile/web)**: o cabeçalho agora abre com um cartão
   dourado do **Meu time** (nome, total de pontos, rodada e situação do mercado — ex.:
   “Rodada 35 • Mercado Aberto”) e um cartão para cada **time cadastrado** (nome + total de
   pontos). Não logou? O cartão do Meu time vira um convite: “Entre com a Globo — o time da
   sua conta entra sozinho”. A lista detalhada (status de cada time), as ligas e a pontuação
   por rodada viraram **seções ocultas**: no celular começam fechadas — um toque no título
   abre —, na tela larga (desktop) começam abertas, e a escolha de cada seção fica guardada
   no navegador. A coluna lateral saiu; agora é uma coluna só, que se adapta do celular ao
   desktop (as tabelas rolam de lado no toque).

2. **SEMPRE todas as rodadas**: o seletor de janelas (“Rodadas 34–38”, “1–5”…) saiu do ar.
   A pontuação por rodada — e o histórico de fase/posição nas ligas mata-mata e pontos
   corridos — mostra TODAS as rodadas, de 1 até a última com pontuação, com rolagem
   horizontal onde precisar.

3. **A regra da rodada atual**: a pontuação vai **ATÉ A RODADA EM ANDAMENTO** — o parcial da
   rodada corrente entra na tabela e na soma (acompanha ao vivo). **Com o mercado ABERTO**
   (ou fechado, antes da bola rolar), a rodada listada como “atual” ainda não pontuou —
   nesse caso o histórico vai **até a ANTERIOR** (a última completa). A regra aparece na
   barra de status (“Histórico completo até a rodada 34 — mercado aberto/fechado: a rodada
   35 ainda não pontuou, então vale a anterior”), no subtítulo da tabela (“Rodadas 1–34” ou
   “Rodadas 1–35 • parcial”) e, na temporada recém-aberta (mercado aberto para a rodada 1),
   o painel mostra “Aguardando a 1ª rodada” em vez de erro.

## Novidades da versão 29 — PRONTO PARA A NUVEM (a sessão não morre mais)

Você reportou: *“esse site deploy do projeto não funciona — mata sessão e copiar e colar
automático”* (https://superliga-fabiao.onrender.com). Diagnóstico feito no site no ar, com três
causas — e as três corrigidas:

1. **“Mata sessão”**: as sessões vivem SÓ na memória do servidor (de propósito) e o plano
   gratuito do Render hiberna o serviço após ~15 min sem acesso, apagando a memória. Resultado:
   você entrava, voltava depois e estava deslogado. **Correção (v29)**: cópia de reserva da
   credencial no navegador do painel + rota `POST /auth/restaurar` no servidor — o servidor
   acorda, o painel reenvia a reserva, o servidor revalida na API do Cartola (renovando com o
   refresh_token quando o access_token venceu) e recria a sessão. A sessão agora sobrevive a
   hibernação, reinicio e novo deploy, e continua morta de verdade no Sair (revogação + limpeza
   da reserva). Detalhes de privacidade na seção “Como publicar na NUVEM” acima.
2. **“Copiar e colar automático” não funcionava**: o login automático usa um Chrome controlado
   NA MÁQUINA DO SERVIDOR — na nuvem não há Chrome nem tela (confirmado no ar: a rota respondia
   “Não encontrei o Google Chrome nem o Microsoft Edge neste computador”). **Correção (v29)**:
   na nuvem o servidor responde indisponível com a explicação certa (“Este painel está na NUVEM…”)
   e o painel abre o modo manual de cara — janela comum da Globo (Google/Facebook funcionam nela)
   + conclusão automática pelo endereço (leitura da área de transferência; no celular, colar no
   campo). O automático continua sendo o padrão no uso local, onde funciona de ponta a ponta.
3. **Deploy meia-boca**: o servidor vinha configurado para ouvir só em `127.0.0.1` (uso local) —
   na nuvem isso exige definir `HOST=0.0.0.0` à mão e, se esquecido, o serviço fica “no ar, mas
   inalcançável”. **Correção (v29)**: com `PORT`/`RENDER` no ambiente (a plataforma define), o
   servidor ouve em `0.0.0.0` sozinho; o cookie de sessão ganha `Secure` atrás de proxy HTTPS e
   o log de inicialização mostra o modo (local x nuvem).

Extras da v29 no painel: aviso “Acordando o servidor na nuvem…” quando a primeira resposta
demora (hibernação do plano gratuito), toque de manutenção a cada 5 min com a aba aberta (instância
acordada enquanto você usa) e mensagens de rede que agora explicam os dois mundos (local x nuvem).

Testes: bateria nova **v29** (painel com stub — reserva guardada no login, boot restaurando a
sessão quando o servidor acordou sem memória, reserva apagada quando a Globo recusa, Sair
apagando a reserva, atualização da reserva na renovação; e servidor REAL rodando com API do
Cartola e OIDC mockados — restaurar cria sessão de verdade e devolve cookie, reserva inválida
não vira sessão, logout segue matando tudo). Regressões: v27, v28, logout v25, Google v26,
sem extensão, v15/v16/v20/v23 — todas passando.

## Novidades da versão 28 — O SAIR LIMPA TAMBÉM OS TIMES BUSCADOS

Você pediu: *“limpe também dados do time pesquisado quando desloga”*. Até a v27, o Sair removia
só o time vindo do login; os times que você adicionou pelo campo “Buscar time” — e as pontuações
deles — continuavam na lista depois de deslogar. A v28 fecha o ciclo do “Sair mata tudo” (v25):

- **A lista de times volta a ZERO**: sai o time da conta E os buscados, com todo o histórico de
  pontos por rodada. O painel fica EXATAMENTE como na primeira abertura (métrica “Times
  monitorados: 0”, lista e tabelas mostrando a orientação).
- **Dados da conta fora da memória da página**: os dados brutos de ligas e de competições de
  pontos corridos também são zerados ao deslogar (nada da sua conta fica na aba aberta).
- **O status conta o que foi feito**: “Você saiu. Sessão encerrada, token revogado na Globo,
  cookies apagados e times limpos (a lista voltou a zero, inclusive os buscados)…”. A janelinha
  oficial de logout da Globo segue abrindo e fechando sozinha (v25).
- **Manter o time monitorado virou decisão da sessão, não do histórico**: cada sessão começa
  vazia — entre com a Globo (seu time entra sozinho) e/ou busque os times que quiser monitorar.

Testes: bateria nova **v28 com 21 verificações** (roda o script real e o doLogout() COMPLETO):
cena com time da conta + liga da conta carregada + time buscado → Sair → lista a zero, pontuações
desaparecem, dados brutos zerados, authbox de volta a “Entrar com Globo”, janelinha oficial da
Globo aberta com client_id, status explicando, segundo Sair sem quebrar (idempotente). A v27 foi
termo a termo para o contrato novo (agora 41 verificações). Regressões: v15 (61), v16, sem
extensão (88), v20 (19), v23 (23), logout v25 (40) e E2E v26 com Chrome real (35) — todas
passando. E2E real no navegador: time buscado na lista → Sair → lista vazia e orientação de volta
(preview_v28_sair_limpa_times.png).

## Novidades da versão 27 — SEM TIME PRÉ-CASTRADO (o painel começa vazio)

Você pediu: *“remova o time inicial”*. Até a v26, o painel vinha com o **Super Fabiao PRO FC**
(id 1382686) fixo no código — ele era carregado e monitorado sozinho em toda abertura. A v27
tira isso: **nenhum time é monitorado sem você pedir**. O que muda na prática:

- **O painel abre VAZIO**: lista de times sem ninguém e métrica “Times monitorados: 0”. Nenhuma
  chamada de histórico (/time/id/) e nenhuma busca automática acontece no boot — só a rodada
  atual é consultada (para o cabeçalho).
- **Nada ficou em branco para te deixar perdido**: a lista e a tabela “Pontuação por rodada”
  mostram orientação (“Entre com a Globo — o time da sua conta entra sozinho — ou use ‘Buscar
  time’”) e a barra de status confirma (“Rodada X carregada. Nenhum time monitorado ainda…”).
- **Dois caminhos para ter times** (os únicos, como já era):
  1. **LOGIN** — ao entrar com a Globo, o time da sua conta entra sozinho na lista (selo “meu
     time”) e é a partir dele que as ligas clássicas/mata-mata/pontos corridos carregam;
  2. **BUSCA** — o campo “Buscar time” acima adiciona qualquer time do Cartola pelo nome.
- **Sair (v28) limpa TUDO**: ao deslogar, TODOS os times saem da lista — o do login E os que
  você buscou à mão — com as pontuações; o painel volta ao estado de fábrica (v28). Na v27 os
  buscados ainda ficavam; o pedido foi mudar isso.
- Se um dia quiser voltar a ter um time fixo de fábrica, é uma linha: preencha
  `INITIAL_TEAMS = [{name:"Nome do time", id:123456, slug:"slug-do-time"}];` no index.html
  (a variável continua lá, agora vazia, com instrução no lugar).

Testes: bateria nova **v27 com 39 verificações** (41 hoje, depois do contrato da v28) — roda o
script real do painel: boot vazio
sem chamar /time/id/ nem busca automática; orientação nas tabelas; login recolocando o time da
conta (mine + fromLogin) e religando as ligas; busca manual adicionando/monitorando outro time;
duplicidade bloqueada; Sair removendo só o time do login (na v28, TODOS saem — ver acima);
estrutura (INITIAL_TEAMS = []).
Regressões completas: v15 (61), v16, sem extensão (88), v20 (19), v23 (23), logout v25 (40)
e E2E v26 com Chrome real (35) — todas passando. E2E no navegador com a API REAL do Cartola:
painel abriu com 0 times/rodada 35; busca por “Super Fabiao PRO FC” achou o time (id 1382686)
e carregou as 35 rodadas (total 2.972,73).

## Novidades da versão 26 — O GOOGLE DEIXOU DE TER O QUE VER PARA BLOQUEAR

Você clicou em “Continuar com Google” na janela controlada e recebeu de novo o aviso
“Este navegador ou app pode não ser seguro”. Causa raiz encontrada: para capturar o retorno
do login sozinho, o painel liga o canal de depuração do Chrome — e uma das ligações que ele
usa (o `Runtime.enable`) é EXATAMENTE o que o Google sente para negar o login social. Até a
v25 essa ligação ficava ativa em TODAS as páginas, inclusive nas do Google. Agora não mais:

- **Runtime DESLIGADO nas páginas do Google/Facebook**: quando a janela entra em
  accounts.google.com (ou no Facebook), o servidor reanexa a sessão de controle SEM o
  Runtime — invisível para a página, nada é recarregado. Voltou para a Globo? Reanexa COM
  ele de novo. O retorno do login continua capturado pelas outras duas redes (interceptação
  da requisição + vigia de URL), que o Google não enxerga.
- **Repórter JS se auto-desliga nessas páginas**: o script que entrega o endereço não cria
  temporizador nem nenhum efeito dentro do Google/Facebook — zero pegadas lá.
- **Importante e honesto**: o Google pode AINDA bloquear por outros sinais (perfil novinho,
  sem histórico). Mas o dedo-duro principal sumiu — e, se bloquear mesmo assim, agora o
  aviso aparece SEM causar pânico, porque:
- **O link “modo manual” PISCA em amarelo** no cabeçalho quando o Google/Facebook recusa
  (impossível de não achar). Ele para de piscar quando você clica nele, quando o login
  conclui ou quando você sai. A orientação em tempo real continua: entre com E-MAIL e
  SENHA da Conta Globo na própria janela controlada (funciona normalmente), ou use o modo
  manual, cuja janela é a comum do seu navegador — ali o Google aceita.
- Textos reajustados: a mensagem inicial não afirma mais que o botão do Google “é recusado”
  (com a mudança, ele pode até funcionar); o aviso do Google agora diz também que, se você
  não clicar em “Sair”, as próximas entradas podem já abrir logadas (o Sair apaga esses
  cookies — v25).

Testes: bateria nova **E2E v26 com 35 verificações** (Chrome real, offline): cenário A
(Google → retorno direto: aviso na hora, reanexação sem Runtime, login conclui, PKCE confere,
Sair devolve end-session com id_token_hint) e cenário B (Google → volta à Globo → retorno:
Runtime religado nos dois sentidos, login conclui). Regressões: v23 (23), v24 estrutural (88),
logout v25 (40), mata-mata (61) e pontos corridos — todas passando.

## Novidades da versão 25 — O “SAIR” AGORA MATA TUDO (sessão, cookie e cookies da Globo)

O que você pediu: *“quero que mate a sessão, cookies quando clicar em sair”*. Até a v24, o Sair
apagava a sessão do PAINEL — mas a Globo continuava lembrando de você: clicar em “Entrar com
Globo” de novo entrava sem pedir a senha. Agora o Sair encerra TUDO, em quatro camadas:

- **Sessão local morre**: o token OIDC, o refresh_token e o id_token saem da memória do
  servidor e o cookie do painel (`sf_session`) é expirado na hora (Max-Age=0, HttpOnly).
- **O token é REVOGADO na Globo**: o servidor chama o endpoint oficial de revogação do
  Keycloak (`/revoke`, RFC 7009) com o refresh_token — mesmo que essa credencial tenha
  caído em algum lugar, ela deixa de valer lá. Melhor esforço: uma falha de rede não
  impede o logout.
- **O perfil do navegador controlado é APAGADO**: o login automático usa um Chrome com
  perfil próprio (`~/.superliga-fabiao/chrome-globo`) — é lá que ficam os cookies de SSO
  da Globo. Ao sair, o servidor fecha qualquer navegador desses em execução e apaga a
  pasta inteira (com tentativas, para vencer travas de arquivo do Windows). Login
  seguinte = Globo pede e-mail e senha de novo.
- **Os cookies da Globo no SEU navegador também vão**: o servidor devolve o endereço
  OFICIAL de logout da Globo (end-session do Keycloak com `client_id` + `id_token_hint`
  guardado no login — logout direto, sem página de confirmação) e o painel abre numa
  janelinha 430x560 que **se fecha sozinha em ~3 s**. Pop-up bloqueado? O painel avisa e
  o resto do logout continua valendo.

Barra de status acompanha tudo: “Encerrando a sessão e apagando os cookies…” → “Você saiu.
Sessão encerrada, token revogado na Globo e cookies apagados — o próximo login vai pedir
e-mail e senha.”. Detalhes preservados: o Sair também cancela login automático/manual em
andamento e fecha as janelas dele; times monitorados que você adicionou pela BUSCA pública
continuam no painel depois do logout (são dados abertos — só as LIGAS da conta é que pedem
login); o botão tem trava contra duplo clique.

Testes: bateria nova de logout com **40 verificações** (estrutura do server.js e do painel +
servidor real: cookie expirado, perfil apagado do disco, sessão morta no `/auth/me`, logout
idempotente, CSRF 403, rotas OIDC intactas) e E2E no navegador real — clique no Sair →
janelinha abriu o end-session oficial da Globo → fechou sozinha → painel voltou ao estado
deslogado. Regressões: v24 estrutural (88), E2E do navegador controlado (23), mata-mata (61)
e pontos corridos — todas passando.

## Novidades da versão 24 — CLICOU EM “ENTRAR COM GLOBO”, ABRIU O NAVEGADOR. ACABOU O DIÁLOGO.

O que você pediu: *“remova a janela entrar com a sua conta globo e entre direto no navegador ao
clicar em entrar com globo”*. Feito — e conferido AO VIVO (Chromium real, sessão Globo ativa:
clique → navegador abriu → Globo lembrou da conta → ligas carregadas sem tocar em mais nada).

- **O diálogo “Entrar com sua conta Globo” FOI REMOVIDO** (inclusive o formulário de e-mail/senha,
  que era o caminho mais sujeito a captcha). Clicar em **Entrar com Globo** agora abre DIRETO o
  navegador controlado na página da Globo: você entra lá (e-mail e senha; o botão do Google
  continua sendo bloqueado pelo PRÓPRIO Google nessa janela — veja a v23), o servidor captura o
  retorno sozinho, **fecha o navegador e carrega as ligas**. Sem diálogo, sem copiar, sem colar.
- **Todas as orientações foram para a barra de status** (topo do painel): o que fazer na janela,
  o aviso do Google na hora em que ele acontecer, erros e progresso.
- **Clicar de novo reinicia**: fecha o navegador anterior e abre outro (nada de travar).
- **O antigo diálogo virou um fallback enxuto, “modo manual”** — link discreto ao lado do botão
  (e aberto automaticamente se não houver Chrome/Edge controlável): é a JANELA COMUM do seu
  navegador (Google/Facebook funcionam nela) + o campo para colar o endereço, com tudo que a
  v19–v21 já fazia (aviso da página em branco, 📋 Colar e concluir, Ctrl+V, leitura automática
  ao voltar o foco, fechar a janela e carregar as ligas).
- A rota de e-mail/senha continua no servidor para quem quiser usar por conta própria, mas o
  painel não tem mais esse formulário.

Testes: 88 verificações estruturais (incluindo “sem resquício do diálogo antigo”), E2E do aviso
do Google (23) e E2E do navegador controlado (19), regressões mata-mata (61) e pontos corridos —
todas passando. Verificação visual: clique → navegador aberto direto (sem diálogo) + fallback
manual renderizando completo.

## Novidades da versão 23 — O AVISO "ESSE NAVEGADOR OU APP PODE NÃO SER SEGURO" (RESOLVIDO)

Se você clicou em **“Continuar com Google”** na janela do Chrome que o painel abre e recebeu:

> Não foi possível fazer o login
> Esse navegador ou app pode não ser seguro. Saiba mais
> Tente usar outro navegador. Se você já está usando um navegador compatível, tente fazer login novamente.

**Calma: não é erro do painel nem da Globo — e a página não está mentindo.** Essa mensagem é do
PRÓPRIO GOOGLE: ele recusa login dentro de janelas de navegador que estão com a **porta de
depuração (CDP) ligada** — e é exatamente assim que o painel consegue capturar o retorno do login
sozinho (sem você copiar nada). É uma regra de segurança documentada do Google (suporte deles,
thread 25209002; e os próprios projetos de automação, como chromedp e Puppeteer, relatam o mesmo).
Nenhum ajuste no painel consegue — nem deve — desligar essa proteção.

**O que fazer (funciona hoje, sem atualizar nada):** na janela do Chrome que o painel abre,
**entre com E-MAIL e SENHA da Conta Globo** (resolva o captcha se a Globo pedir). Isso sempre
funcionou nessa janela. Só o botão do Google/Facebook é que eles bloqueiam. E você faz isso
**uma vez só**: o Chrome usado pelo painel tem perfil PRÓPRIO e PERSISTENTE
(~/.superliga-fabiao/chrome-globo) — depois do 1º login, a Globo lembra e as próximas vezes a
janela nem pede login: entra, fecha sozinha e as ligas carregam.

**Sua conta Globo só entra com Google/Facebook?** Use o **modo manual** no diálogo de login
(“usar o modo manual”): lá a janela é a comum do SEU navegador, sem porta de depuração — o
Google/Facebook aceitam normalmente, e o resto continua automático (Ctrl+L, Ctrl+C e o painel
conclui, fecha a janela e carrega as ligas).

O que a v23 acrescenta para essa situação nunca mais pegar você de surpresa:

1. **Aviso ANTES de abrir**: o diálogo de login já explica — nesta janela, e-mail e senha;
   o botão do Google é bloqueado pelo próprio Google (com o motivo).
2. **Detecção ao vivo**: se mesmo assim a janela cair na página do Google (ou do Facebook),
   o servidor percebe na hora e o painel mostra a orientação imediatamente — sem esperar
   você adivinhar. O fluxo NÃO morre: você volta lá e digita e-mail/senha, ou cancela e usa
   o modo manual.
3. **Menos pistas de automação**: o Chrome passa a abrir com
   `--disable-blink-features=AutomationControlled` (não expõe `navigator.webdriver`) — ajuda
   com o hCaptcha e com a página da Globo. Não afeta a regra do Google (que olha a porta de
   depuração), por isso a orientação dos itens 1–2 é o caminho certo.

Testado nesta versão (E2E offline, Chromium real): detecção da página do Google → aviso chega
ao painel IMEDIATAMENTE (sem repetição), o fluxo continua vivo e o login conclui sozinho em
seguida (código trocado, sessão criada, navegador fechado). Regressões: E2E v22 (19 verificações),
login sem extensão (82), mata-mata v15 (61) e pontos corridos v16 (74) — todas passando.

## Novidades da versão 22 — O NAVEGADOR COPIA SOZINHO, FECHA SOZINHO, AS LIGAS CARREGAM SOZINHAS

Pergunta desta entrega: *“veja a possibilidade de copiar com js e fechar o navegador”*. Resposta:
**dá — e está implementado e testado**. Como a Globo só aceita redirecionar para o endereço DELA
(localhost recusado), o painel não pode ler a janela comum do navegador. Mas o SERVIDOR pode abrir
um **Chrome/Edge controlado** (porta de depuração CDP, sem extensão e sem dependências) e capturar
o retorno `login-callback.html?code=…&state=…` com TRÊS redes independentes:

1. **Interceptação da requisição (Fetch)** — o endereço é capturado ANTES de a página da Globo
   carregar; a página em branco nem roda, então o código de uso único nunca é gasto;
2. **Vigia do endereço da janela (targetInfoChanged)** — pega qualquer troca de URL da aba,
   inclusive com `#fragmento`;
3. **COPIA POR JS (novo na v22)** — um repórter JS é injetado em TODA página que esse navegador
   abrir: a própria página entrega o seu endereço ao servidor por um binding interno do DevTools
   (canal privado, sem rede e sem área de transferência). Pega até troca de endereço que não gera
   requisição (`history.replaceState`) e mudanças tardias de URL — compara a cada 0,7 s por 5 min.

Qualquer rede conclui o login sozinha; as outras ficam de segurança. Na sequência, sem você tocar
em nada:

- o código é trocado pelo token OIDC com o verifier do PKCE (o desafio fica só no servidor);
- o servidor **FECHA O NAVEGADOR SOZINHO** (Browser.close; se travar, SIGTERM e, como garantia
  final, SIGKILL) — a janela de retorno nem aparece;
- o painel recebe `loggedIn`, fecha o diálogo e **carrega as ligas, mata-mata e pontos corridos
  sozinho**.

No fim, **nada é copiado, nada é colado, nenhuma tecla é apertada** — só o login na página da
Globo (que fica com a sua senha, como sempre). Janelas de login social (Google/Facebook) e
pop-ups do hCaptcha também são vigiados.

Testado de verdade nesta versão: E2E offline com Chromium real (143) e servidores Globo falsos —
19/19 verificações, incluindo captura por interceptação, captura **exclusivamente por JS** (retorno
via `#fragmento`, que a rede não vê), PKCE conferido (sha256 do verifier == challenge), sessão
e cookie criados, navegador fechando sozinho nos dois caminhos, fallback sem Chrome/Edge
(`{unavailable:true}` → modo manual) e cancelamento fechando o navegador. Regressões v15/v16 e as
82 verificações de login: todas passando.

Plano B mantido: sem Chrome/Edge (ou se você preferir), o botão cai no modo manual anterior —
e-mail/senha direto, ou janela comum com Ctrl+L/Ctrl+C e leitura automática da área de
transferência (versões 19–21 abaixo).

## Novidades da versão 21 — E-MAIL/SENHA EM PRIMEIRO LUGAR; A JANELA SE FECHA SOZINHA

Investigação a fundo do lado da Globo confirmou que o redirecionamento automático para o painel
é impossível: localhost é recusado no `redirect_uri`, a página de retorno não pode ser embutida
em iframe (`X-Frame-Options: SAMEORIGIN`) e o aviso interno dela (postMessage) vai somente para
o próprio site da Globo (`window.parent` + targetOrigin `cartola.globo.com`) — nunca para uma
janela do painel. A v21 ataca por dois lados:

1. **E-mail e senha agora é o caminho PRINCIPAL** (topo do diálogo): digita uma vez, as ligas
   carregam sozinhas — sem janela, sem copiar endereço, sem permissão nenhuma. Se a Globo pedir
   captcha, o painel abre a janela oficial sozinho na sequência.

2. **Pela janela oficial** (continua disponível, e agora conclui sozinha):
   - o aviso de permissão da área de transferência é pedido NA FRENTE (antes de a janela navegar
     para a Globo), com instrução clara do que clicar;
   - detectado o endereço copiado (Ctrl+L, Ctrl+C na página em branco — as únicas teclas
     necessárias; todo o resto é bloqueado pela Globo), o painel conclui o login,
     **FECHA a janela da Globo**, devolve o foco e **carrega as ligas sozinho**;
   - a leitura automática não desiste: se a permissão estiver negada, avisa 1 vez como religar
     (ícone do site → Permissões → Área de transferência → Permitir) e volta a tentar cada vez
     que o painel recebe foco;
   - rede de segurança mantida: 📋 Colar e concluir, Ctrl+V no campo, código sozinho e o campo
     manual continuam funcionando.

## Novidades da versão 20 — LOGIN CONCLUI SOZINHO (sem colar nada)

A Globo só aceita redirecionar o login para o endereço DELA (`cartola.globo.com/login-callback.html`)
— localhost é recusado —, então um redirecionamento automático para o painel é impossível. O que
a v20 faz é o mais perto disso: **o painel detecta o endereço copiado SOZINHO e conclui o login**.

Fluxo novo (o Ctrl+V/colar deixou de ser obrigatório):

1. **Entrar pela janela da Globo** → entre com sua conta (ou nem precise: se já está logado, a
   janela vai direto para a página em branco — é normal, deu certo).
2. Na página em branco: **Ctrl+L** e **Ctrl+C**.
3. **Volte ao painel. Pronto.** O painel lê a área de transferência (o navegador pede permissão
   1 vez — permita), reconhece o endereço do próprio fluxo e conclui o login sozinho; a janela
   da Globo se fecha.

Rede de segurança (se o automático não rodar):
- **Ctrl+V** no campo do painel também conclui sozinho (sem clicar em nada);
- botão **📋 Colar e concluir** lê a área de transferência no clique;
- campo + **Concluir login** continuam aí; e **código sozinho** (sem a URL) também vale;
- se a permissão de leitura for negada, o painel avisa e orienta o plano B — sem travar.

Detalhes honestos: a leitura automática só acontece com o painel em foco (você acabou de voltar),
conteúdo repetido nunca é reprocessado, endereço de outra tentativa é recusado com aviso e a
senha/token continuam sem tocar no painel.

## Novidades da versão 19 — A JANELA EM BRANCO AGORA SE EXPLICA

Melhorias no login pela janela oficial (a versão 18 já logava; o que faltava era clareza):

- **Aviso amarelo em destaque**: assim que a janela abre, o painel já explica que a página
  final EM BRANCO é o esperado e o que copiar dela;
- **Botão "📋 Colar e concluir"**: lê o endereço direto da área de transferência (o Chrome/Edge
  pedem permissão 1 vez) e conclui o login sozinho — sem Ctrl+V;
- **Janela fechada sem copiar?** O painel percebe e diz exatamente o que fazer;
- **Servidor desatualizado detectado**: se o `server.js` em execução for antigo (sem a rota de
  login), o painel avisa para substituir os arquivos e reiniciar (`Ctrl+C`, `node server.js`);
- Endereço de tentativa antiga (state diferente) é recusado com instrução clara, antes de falhar.

### Passo a passo do login (igual à versão 18)

1. Rode `node server.js`, abra http://localhost:3000 e clique em **Entrar com Globo**.
2. Clique em **Entrar pela janela da Globo**: abre a MESMA página de login que o site do
   Cartola usa (Conta Globo — e-mail/senha, Google ou Facebook; resolva o captcha lá, se pedido).
   Se você já está logado na Globo neste navegador, ela nem pergunta nada: vai direto ao passo 3.
3. No fim, a janela mostra um endereço `cartola.globo.com/login-callback.html?code=…&state=…`
   com a página em branco — **é normal e significa que deu certo**. Copie o endereço inteiro
   (Ctrl+L, Ctrl+C) SEM fechar a janela.
4. Cole no painel e clique **Concluir login** (ou **📋 Colar e concluir**): o servidor troca o
   código pelo token OIDC (Authorization: Bearer + x-glb-auth: oidc) usando o desafio PKCE que
   só ele tem, valida na API e cria a sessão. Pronto: ligas clássicas, mata-mata e pontos
   corridos carregam.

### "A janela abriu uma página em branco" — não é erro

É o comportamento CORRETO do login Globo quando você já está logado: o site pula a tela de
senha e cai direto na página de retorno (`login-callback.html`), que é uma página técnica vazia
do próprio Cartola (só carrega o globoid-js). O que vale é o ENDEREÇO dela:

1. Clique na janela em branco;
2. **Ctrl+L** (seleciona o endereço) e **Ctrl+C** (copia);
3. Volte ao painel e clique **📋 Colar e concluir** (ou cole no campo e **Concluir login**).

Se fechar a janela sem copiar, clique em **Abrir a janela de novo**: como sua sessão Globo
continua ativa, ela volta para a página em branco em instantes — copie então.

Detalhes técnicos (pesquisados e confirmados AO VIVO na Globo em 12/11/2026):
- Keycloak da Globo: `goidc.globo.com`, realm `globo.com`, client `cartola-web@apps.globoid`
  (o mesmo do site oficial, descoberto no próprio fluxo de login do cartola.globo.com);
- redirect_uri registrado do client: `https://cartola.globo.com/login-callback.html` — foi o
  usado; o `http://127.0.0.1:3000` é REJEITADO pela Globo ("does not match any of the OAuth 2.0
  Client's pre-registered redirect urls"), por isso o endereço final precisa ser colado no painel;
- conferido no próprio `callback.min.js` da Globo: com um state que ela não conhece, a página de
  retorno NÃO consome o código (só repassa uma mensagem interna) — o código continua válido para
  o painel trocar, e o endereço permanece na barra até o usuário copiar;
- a troca do código replica exatamente o que o site oficial faz (`grant_type=authorization_code`,
  `client_id`, `redirect_uri`, `code_verifier` PKCE S256);
- se a Globo entregar refresh_token, o servidor RENOVA A SESSÃO SOZINHO antes de cada consulta
  (o cookie local dura 7 dias); se não entregar, a sessão vale ~1 hora;
- a página de login da Globo exige hCaptcha — por isso a senha é digitada nela (janela oficial),
  nunca no painel.

## Atalho: login direto por e-mail/senha (opcional)

Ainda é possível digitar e-mail e senha no painel: o servidor local tenta o login direto na
Conta Globo (authx — a mesma API que o site do Cartola usa, client `cartola-web@apps.globoid`,
serviceId 6860). Se funcionar na sua rede, conecta sem abrir janela nenhuma.

Se a Globo pedir verificação de segurança (captcha) — comum, vale para toda automação em 2026 —
o painel abre a janela oficial SOZINHO na sequência: entre nela (a senha fica só com a Globo) e
colo o endereço final. A senha digitada no atalho é usada na hora e descartada: o servidor local
não grava, não registra em log e não reenvia a senha para ninguém além dos endpoints oficiais.

Por que o atalho pode falhar (medido em 11–12/11/2026): a API legada
(login.globo.com/api/authentication) responde 406 `captchaBlank`; o password grant do Keycloak
está DESLIGADO para o client do Cartola (`unauthorized_client`); e a página nova da Conta Globo
já dispara hCaptcha no passo do e-mail. Ou seja: quando a Globo cobra captcha, não existe login
de e-mail/senha 100% "por API" — e a janela oficial sempre funciona.

Segurança:
- Na janela oficial, a senha fica só na página da Globo (o painel não vê).
- O token e o verifier do PKCE ficam só na memória do servidor local. O navegador recebe apenas
  um cookie de sessão HttpOnly/SameSite=Strict (o token da Globo nunca vai para o navegador).
- O servidor escuta só em 127.0.0.1. Para expor em rede, defina HOST, mas apenas em rede
  confiável e com HTTPS na frente.
- POSTs de outra origem são bloqueados (CSRF).

Limitações honestas:
- Nada disso é API oficial da Globo: o client/fluxo é o do próprio site e pode mudar sem aviso.
- O código colado vale poucos minutos e é de uso único. Se der "código não aceito", clique de
  novo em **Entrar pela janela da Globo** — com a sessão Globo já ativa, é só repetir em segundos
  (sem digitar senha de novo).

## Time cadastrado

- **Desde a v27 o painel NÃO vem mais com time fixo**: a lista começa vazia e os times entram
  pelo login (o time da conta entra sozinho) ou pelo campo “Buscar time”.
- Histórico/curiosidade: o Super Fabiao PRO FC tem ID Cartola **1382686** (slug
  super-fabiao-pro-fc), confirmado na API pública (/times?q=Super Fabiao PRO FC, verificado em
  10/11/2026) — na v27 ele entrou pela busca no E2E real e carregou as 35 rodadas.
- O id 49854573 que já foi fixado no passado pertence a outro time do mesmo cartoleiro ("Super
  fabiao infinity MM") — era configuração errada, hoje não existe mais nada fixado no código.
- Ao conectar com a Globo, o painel marca como "meu time" o time que a sessão retornar (/auth/time).

## Observações

- As posições por rodada são calculadas entre os times cadastrados no painel.
- Para obter classificação oficial de uma liga, será necessário integrar o identificador da liga e, se exigido, autenticação.
- As fases do mata-mata são personalizadas e devem ser preenchidas com os dados reais do campeonato.
- A API pública pode alterar disponibilidade, campos ou limites de acesso.

## Diagnóstico da versão corrigida

A versão atual:
- tenta os endpoints `/times?q=` e `/busca?q=` para localizar times;
- aceita diferentes formatos de resposta com `time_id` e `nome`;
- limita o histórico a quatro consultas simultâneas para reduzir bloqueios;
- mostra o erro individual na lista lateral para cada time;
- tenta também o domínio legado da API caso o domínio principal responda com erro.

Se os três nomes forem nomes internos/apelidos e não os nomes públicos cadastrados no Cartola, será necessário informar os IDs numéricos dos times. O ID pode ser obtido no resultado da busca pública do Cartola.


CORRECOES DESTA VERSAO:
- O navegador consulta /api/cartola pelo servidor local (server.js), em vez de acessar a API diretamente e sofrer bloqueio CORS.
- A rodada atual precisa vir da API; se a API nao informar a rodada, o painel mostra erro em vez de assumir 38.
- A pontuacao acumulada e exibida no formato brasileiro (ex.: 2.918,55). O total e a soma das pontuacoes das rodadas retornadas.
- A posicao entre times monitorados nao e a classificacao oficial da liga. Para isso, ainda e necessario o link/ID da liga.


## Ligas, classificação, pontuação e fase (com a conta conectada)

Depois de conectar, o painel lê as suas ligas e preenche as abas:
- Ligas Clássicas (nome oficial do Cartola para o que às vezes se chama "pontos corridos"): posição e pontos do seu time na liga, posição no turno, no mês e na rodada, líder da liga e diferença para o líder. Se o time não aparece na 1ª página de uma liga grande, o painel procura nas próximas (até 15 páginas).
- Mata-Mata: situação (aguardando sorteio / em andamento) e a fase de cada rodada (Oitavas, Quartas, Semifinal, Final), calculada pelo início/fim da liga e pelo número de times. SÓ as ligas em andamento entram na mesa (a lista oficial /auth/ligas da própria conta) — nenhum endpoint de ligas encerradas é consultado.
- Pontuação por rodada: pontos do time em cada rodada e o total (API pública).
- O nome de cada liga é um link para a liga no site do Cartola.

Como o painel decide o tipo da liga: "mata_mata" verdadeiro = Mata-Mata; todo o restante = Liga Clássica (o Cartola só tem esses dois tipos oficiais).

Limitações conhecidas:
- A API não informa diretamente EM QUAL fase o seu time foi eliminado no mata-mata; o painel resolve isso, na ordem: pelo chaveamento real da liga e, como reserva, pela observação ao vivo — veja "Ajustes desta versão" abaixo.
- A posição por rodada dentro de cada liga (histórico) não existe na API; o painel mostra a posição atual (campeonato, turno, mês e rodada).
- Em ligas clássicas, vitórias/empates/derrotas podem não estar na API.
- O formato das respostas foi montado a partir de exemplos públicos e do site oficial; se algum campo vier diferente na sua conta, use o botão "{ } Dados brutos" (aparece quando conectado) para ver o JSON e pedir o ajuste.
- Sem refresh_token, o token da Globo vale ~1 hora: depois disso, entre de novo pela janela da Globo (rápido: a sessão Globo do navegador continua ativa, é só copiar o endereço de novo). Com refresh_token, a renovação é automática por até 7 dias.

## Ajustes desta versão (v15 — fase da eliminação lida do CHAVEAMENTO REAL)

A v14 ainda errava fases: dois dos "fontes" da fase da eliminação eram PALPITE disfarçado de dado
— e os testes antigos confirmavam o erro porque usavam campos que não existem na resposta real da
API ("testes viciados"). Esta versão corrige na raiz, mantendo o MESMO visual (mesmas abas, colunas,
selos e cores):

1. O QUE MUDOU NA FONTE DA FASE
   - A resposta do /auth/liga/{slug} para ligas mata-mata traz o CHAVEAMENTO REAL da liga:
     "chaves_mata_mata" (cada confronto com rodada, tipo de fase, mandante, visitante e VENCEDOR)
     e "time_usuario_mata_mata" (seu time no mata-mata). Isso foi confirmado no código do próprio
     site oficial do Cartola (o controlador do chaveamento lê exatamente esses campos).
   - A rodada da queda agora é o confronto em que o seu time PERDEU (vencedor diferente do seu
     time). Se o confronto ainda não tem vencedor gravado e o time está eliminado, é a última
     rodada em que ele aparece no chaveamento (quem vence avança; quem não aparece mais, parou ali).
   - O antigo "palpite por POSIÇÃO" foi REMOVIDO: a posição que a API devolve é a ordem POR PONTOS
     da liga (orderBy=campeonato), não a posição do mata-mata — era isso que apontava fase errada
     (ex.: eliminado nas Oitavas mas 3º por pontos aparecia como "eliminado na Semifinal").
   - O antigo "registro J/V/E/D" também foi removido: esses campos não existem na resposta real.
   - Sobrou como fonte secundária só a observação ao vivo (pin v3, "vivo"), e sem nenhuma fonte o
     painel mostra "Eliminado (fase não registrada)" — nada é inventado, palpite nunca é gravado.

2. O QUE NÃO MUDOU (mantem o visual)
   - Só ligas em andamento da própria conta (/auth/ligas) entram na mesa; nada de encerradas ou
     ligas alheias.
   - Selos Classificado / Eliminado / Em disputa / Campeão 🏆, colunas, cores e layout idênticos.

## Testes (bateria v15, time real Super Fabiao PRO FC — id 1382686)

61 verificações executadas rodando o script real do painel, com o CONTRATO REAL da API (os
fixtures agora reproduzem exatamente os campos que o site oficial consome — sem campos inventados)
e VERDADE calculada de forma independente a partir do chaveamento:
- Eliminado exatamente na fase do confronto perdido: Oitavas (r32), Quartas (r33), Semifinal (r34),
  Final (r35) — selo Classificado nas fases anteriores e NENHUM selo depois da queda.
- Independência da ordem por pontos: eliminado nas Oitavas mesmo sendo 1º ou 3º por pontos (o bug
  que aparecia "Eliminado na Semifinal" não existe mais); vice-campeão 9º por pontos aponta a Final.
- Campeão (venceu tudo no chaveamento) continua "Campeão 🏆" no visual; liga futura sem selos;
  disputa de 3º lugar não cria selo depois da queda.
- Atraso da API: confronto sem vencedor gravado + time eliminado → última aparição no chaveamento.
- Observação ao vivo continua como fonte de reserva (sem chaveamento) e nunca contradita o
  chaveamento real; pin v2 envenenado continua descartado; nada inventado sem fonte.
- Guarda de rotas: só /auth/ligas e /auth/liga/{slug}; nada de encerradas ou busca pública.
- Ligas clássicas intactas (posição e pontos pt-BR).

Dados reais conferidos na API pública em 11/11/2026 (scripts/fixtures/sonda_real_api_v15.json):
rodada 35, temporada 2026, e as 24 ligas mata-mata reais do cartoleiro (nomes/slugs usados nos
testes saem da busca pública /ligas?q=). A resposta completa com chaves_mata_mata exige a sessão
Globo do usuário (401 sem token) — por isso o painel lê o chaveamento quando você conecta a conta.

## Ajustes desta versão (v14 — só ligas ativas + fase de eliminação corrigida)

Base: a versão estável anterior, com o VISUAL mantido (mesmas abas, colunas, selos e cores). O que mudou:

1. SÓ LIGAS ATIVAS NA MESA (o ajuste pedido): a mesa volta a mostrar apenas as ligas em andamento da própria conta, direto da lista oficial /auth/ligas. Todo o esquema de endpoints de ligas encerradas (/auth/competicoes/…) foi REMOVIDO — nada de ligas encerradas na mesa e nenhuma liga alheia pode entrar (nem por busca pública).
2. FASE DA ELIMINAÇÃO CORRIGIDA (o bug principal — as fases saíam erradas):
   - Antes: a fase podia sair de um palpite gravado no navegador (e um palpite errado ficava gravado para sempre) ou, sem histórico, "fase anterior à rodada corrente" — quase sempre errado.
   - Agora, na ordem de confiança:
     a) REGISTRO DO MATA-MATA (J/V/E/D) do seu time na liga — em eliminação simples, a última partida disputada é a que eliminou: rodada da queda = início da liga + jogos − 1.
     b) POSIÇÃO NA CLASSIFICAÇÃO DO MATA-MATA — regra estrutural do chaveamento, válida com a liga em curso: 2º = perdeu a Final; 3º–4º = Semifinal; 5º–8º = Quartas; 9º–16º = Oitavas; 17º–32º = 1ª fase.
     c) OBSERVAÇÃO AO VIVO — se o painel acompanhou semana a semana ("vivo" = última rodada em que o time foi visto na disputa; a queda é na fase dessa rodada ou depois, nunca antes).
   - Nenhuma fonte convence se apontar fase ANTERIOR à última rodada vista vivo (contraria a observação).
   - Sem fonte confiável: "Eliminado (fase não registrada)" — nada é inventado. Palpite NUNCA é gravado.
   - Marca antiga e envenenada do navegador (chave sf_mata_mata_pins_v2) é descartada automaticamente na primeira abertura.
3. CAMPEÃO: liga que encerrou com o time na disputa mostra "Campeão 🏆" (visual mantido).
4. "Dados brutos" segue disponível (botão quando conectado) mostrando o JSON que a API devolveu, para conferência.

## Testes (bateria v14, time real Super Fabiao PRO FC — id 1382686)

47 verificações executadas rodando o script real do painel, entre elas:
- Só as ligas em andamento entram na mesa; nenhuma rota de encerradas ou busca pública é chamada (guarda de rotas).
- Fase da queda por posição (32/16/8 times: pos 20→1ª fase, pos 3→Semifinal, pos 2→Final, pos 5→Quartas), por registro J/V/E/D (com e sem empates) e pela observação ao vivo.
- Fonte que contraria a observação ao vivo é rejeitada; sem fonte, "fase não registrada" sem inventar selos.
- Pin v2 envenenado é ignorado e apagado; vivo é gravado no novo formato v3 sem palpite.
- Campeão, liga futura, formato de item embrulhado {liga:{…}} e clássicas intactas.

API pública real confirmada em 11/11/2026: rodada 35, temporada 2026, time Super Fabiao PRO FC (id 1382686). As rotas /auth/* exigem a sessão da Globo (login pelo painel).


## Novidades da versão 16 — aba “Pontos Corridos” (visual mantido)

Nova terceira aba, ao lado de “Ligas Clássicas” e “Mata-Mata”, com as competições oficiais de
PONTOS CORRIDOS da conta (confronto direto: vitória no duelo = 3 pts, empate = 1, até 38 rodadas).

- Endpoints oficiais do app (domínio novo api.cartola.globo.com, login OIDC do server.js):
  · GET /auth/competicoes/pontoscorridos — lista das competições EM ANDAMENTO da conta;
  · GET /auth/competicoes/pontoscorridos/slug/{slug} — detalhe com ranking, confrontos e participantes.
  O endpoint de encerradas (/finalizadas) NUNCA é consultado — só ligas ativas, como nas outras abas.
- O que cada linha mostra: Times, Rodadas (ex.: 1–38), Situação, Posição (oficial da API) e “de N”,
  Pontos de duelo, V/E/D, Pontos Cartola (pt-BR) e o Líder com seus pontos.
- HISTÓRICO DE POSIÇÕES POR RODADA (o extra pedido): colunas “Rdd N - Pos.” seguem o seletor de
  rodadas (ex.: 31–35, ou 1–38 com rolagem). É reconstruído dos RESULTADOS dos confrontos
  (pontuacao_rodada de mandante × visitante) rodada a rodada e só é exibido depois de reproduzir
  EXATAMENTE a classificação oficial que a API entrega no campo “ranking” — fonte independente.
  Não conferiu (ou rodada ainda em processamento)? A célula fica “—” em vez de mostrar número
  inventado. Rodadas futuras também ficam “—”.
- Botão “{ } Dados brutos” agora inclui a lista e os detalhes das competições de pontos corridos,
  para conferência do JSON real.
- Visual preservado: mesmas abas (agora 3 colunas), cabeçalho roxo próprio (.points), selos,
  pills, me-row e classes de posição (ouro/prata/bronze) já existentes.

## Testes (bateria v16 — 74 verificações + regressão mata-mata v15 — 61 verificações)

Tudo roda o script real do painel. A verdade esperada é calculada de forma INDEPENDENTE nos
fixtures (placares decididos pelo gerador; classificação 3/1/0 reconstruída fora do painel) e o
ranking oficial da API é montado a partir dessa verdade — o painel precisa reproduzi-la:
- P1 valores = verdade: posição 2º/20, pontos de duelo, V/E/D, Cartola pt-BR, líder com nome.
- P1/P2 histórico por rodada (31–35 e 1–38) = posição da verdade em cada rodada; futuras “—”.
- P2 liga de 10 times só ida começando na rodada 30 (células antes do início ficam “—”).
- P3 rodada em processamento: célula corrente “—”, histórico só até a última rodada oficial.
- P4 classificação oficial inconferente (pontos adulterados): histórico OCULTO, posição oficial mantida.
- P5 meu time fora do ranking: linha vem, posição/histórico “—”, sem erro.
- P6 401 na lista: nota pede novo login; resto do painel segue funcionando.
- P7 detalhe de uma liga falha: a outra continua; nota nomeia a falha.
- P8 lista vazia: mensagem honesta. P9 temporada completa: 38/38 células validadas.
- P10 guarda de rotas: lista 1×, detalhe 1× por liga, ZERO chamadas a /finalizadas ou buscas públicas.
- P11 sem login: nota pede login e NADA é consultado. P12 visual: 3 abas, seção roxa, colunas.
- P13 tolerância a lista embrulhada {competicoes:[…]}.
