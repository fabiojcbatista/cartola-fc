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

## Time cadastrado

- ID Cartola: **49854573** (obtido do link enviado)
- O painel mantém somente esse time. O nome público será preenchido automaticamente quando a API retornar essa informação.

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


## Login com conta Globo (Google, Facebook ou e-mail)

O Cartola usa o "login novo" da Globo (OIDC). A API não aceita mais o cookie GLBID: ela exige o access_token do site, enviado como "Authorization: Bearer ..." com os cabeçalhos x-glb-auth: oidc e x-glb-app: cartola_web. Esse token vale cerca de 1 hora. (Fonte: relatos de outros desenvolvedores; não é documentação oficial da Globo.)

A extensão do Chrome/Edge (pasta extensao_chrome) observa a requisição que o próprio site do Cartola faz à API, guarda o token e o entrega ao painel quando você clica em "Conectar". Você não copia nada, e o login do Google funciona porque acontece no seu navegador normal.

Instalar a extensão (uma vez só; se já havia a versão antiga, clique em "Atualizar"):
1. Abra chrome://extensions (ou edge://extensions) e ligue o "Modo do desenvolvedor".
2. Clique em "Carregar sem compactação" e escolha a pasta  extensao_chrome  deste projeto.

Entrar:
1. Rode  node server.js  e abra http://localhost:3000.
2. Em outra aba, entre em https://cartola.globo.com normalmente.
3. No painel, clique em "Entrar com Globo" e depois em "Conectar". Se não houver um token recente, a extensão recarrega a aba do Cartola (ou abre uma em segundo plano por alguns segundos) para capturá-lo. O painel busca o seu time (/auth/time) e o marca como "meu time".

Segurança:
- Sua senha e seu login social ficam só na página da Globo.
- A extensão lê cookies/cabeçalhos apenas de *.globo.com e só conversa com páginas em localhost/127.0.0.1. Ela não altera nenhuma requisição.
- O token passa pela página do painel até o servidor local, que o valida na API e o guarda só na memória (1 hora). O navegador fica com um cookie de sessão HttpOnly/SameSite=Strict.
- O servidor escuta só em 127.0.0.1. Para expor em rede, defina HOST, mas apenas em rede confiável e com HTTPS na frente.

Limitações:
- A Globo não oferece OAuth para apps de terceiros; isto usa o mecanismo interno do site do Cartola e pode mudar sem aviso.
- O token dura ~1 hora. O histórico de pontos usa a API pública e não depende dele; o login serve para descobrir o seu time. Passada 1 hora, clique em "Conectar" de novo para renovar.
- Com a sessão ativa, o proxy também aceita outros endpoints autenticados (ex.: /api/cartola/auth/ligas), úteis para a classificação oficial das ligas.

## Ligas, classificação, pontuação e fase (com a conta conectada)

Depois de conectar, o painel lê as suas ligas (/auth/ligas e /auth/liga/{slug}) e preenche as abas:
- Ligas Clássicas e Pontos Corridos: posição e pontos do seu time na liga, posição no turno, no mês e na rodada, líder da liga e diferença para o líder. Se o time não aparece na 1ª página de uma liga grande, o painel procura nas próximas (até 15 páginas).
- Mata-Mata: situação (aguardando sorteio / em andamento / encerrada) e a fase de cada rodada (Oitavas, Quartas, Semifinal, Final), calculada pelo início/fim da liga e pelo número de times.
- Pontuação por rodada: pontos do time em cada rodada e o total (API pública).
- O nome de cada liga é um link para a liga no site do Cartola.

Como o painel decide o tipo da liga: "mata_mata" verdadeiro = Mata-Mata; "pontos corridos" no tipo/nome = Pontos Corridos; o restante = Clássica.

Limitações conhecidas:
- A API não informa se o seu time já foi eliminado no mata-mata, nem os confrontos; para isso use o link da liga.
- A posição por rodada dentro de cada liga (histórico) não existe na API; o painel mostra a posição atual (campeonato, turno, mês e rodada).
- Em ligas de pontos corridos, vitórias/empates/derrotas podem não estar na API.
- O formato dessas respostas foi montado a partir de exemplos públicos; se algum campo vier diferente na sua conta, use o botão "{ } Dados brutos" (aparece quando conectado) para ver o JSON e pedir o ajuste.
- O token da Globo vale ~1 hora: depois disso, as ligas não atualizam até você clicar em "Entrar com Globo" > "Conectar" de novo.
