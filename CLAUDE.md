# Regras do projeto: Treino e Performance

## O que é este projeto
Painel pessoal de personal trainer digital + acompanhamento de treino do Pablo. Eu (Claude) funciono como personal trainer/preparador físico único: interpreto os dados registrados e ajusto o plano a cada conversa. Objetivo do Pablo: composição corporal (massa magra + redução de gordura), condicionamento físico com transferência real pro tênis, e eficiência cardiovascular (FC menor pro mesmo esforço). Anamnese completa, avaliação, objetivos e estratégia (Fases 1-4) foram concluídos antes de qualquer treino ser montado — ver MEMORY.md para o histórico completo.

## Arquivos deste projeto
| Arquivo | Descrição |
|---|---|
| `plataforma-treino-performance.html` | O artefato principal — dashboard single-file HTML/CSS/JS vanilla, sem build tools. Publicado no GitHub + Vercel. Persistência em **Firebase Firestore** (projeto `treino-performance-pablo`, isolado — sem relação com o projeto da Mentoria Residência) + tela de senha (Firebase Auth anônima). Contém Dashboard, Treino, Histórico, Progresso, Análise, Metas. |
| `MEMORY.md` | Histórico completo de tudo que já foi feito neste projeto, sessão a sessão (anamnese, avaliação, objetivos, estratégia, pesquisa científica, decisões técnicas). |
| `vercel.json` | Config de deploy — rewrite de `/` para o arquivo HTML principal. |

## Regras inegociáveis
1. **Nunca fabricar dados de treino.** Cargas, reps, FC, RPE, peso corporal — tudo deve vir de registro real feito pelo Pablo na própria plataforma ou digitado por ele a partir do Apple Watch. Não existe sincronização automática com Apple Health (não há API pública pra isso a partir de um site estático) — é sempre entrada manual, e isso deve ficar claro na interface.
2. **Banco de dados isolado.** Firebase Firestore do projeto `treino-performance-pablo` (apiKey `AIzaSyDqz6_JnwdZv4i1Y9Gpofwx1DeB63nqtTc`, ver config completo no `<script>` do HTML). Nunca misturar com o projeto/Firebase da Mentoria Residência — são projetos e links diferentes por decisão explícita do Pablo (09/2026).
3. **A plataforma continua um único arquivo HTML** (HTML+CSS+JS inline, sem framework, sem build step). Única dependência externa: Firebase SDK via CDN (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`, v10.13.2), mesmo padrão do projeto da Mentoria. Nenhuma outra dependência deve ser introduzida sem necessidade real.
4. **Acesso protegido por senha** ("acad1703", definida por Pablo) já que o link da Vercel é público. A senha fica com hash SHA-256 no código (`PASSWORD_HASH`), nunca em texto puro no JS. As regras do Firestore devem exigir `request.auth != null` (login anônimo do Firebase acontece só depois da senha certa).
5. **A interpretação dos dados da aba Análise (Apple Watch + RPE/sono/fadiga) é feita por mim em conversa com o Pablo**, sessão a sessão — nunca um algoritmo automático "decidindo" dentro do HTML se ele está com fadiga ou se deve mudar o treino. O app registra e mostra o dado bruto; a análise vem da conversa.
6. **Progressão de carga nunca é pré-definida.** O plano define séries/reps/RIR-alvo; a carga usada em cada exercício é sempre a que o Pablo registrar na primeira vez que faz aquele exercício (vira a linha de base), e as sessões seguintes comparam automaticamente com o histórico (hoje × última vez × melhor marca).
7. **Nunca commitar nem dar push para o GitHub sem confirmação do Pablo na sessão**, exceto quando ele autorizar explicitamente um fluxo contínuo de deploy automático.
8. **Manter o MEMORY.md deste projeto atualizado** ao final de cada sessão de trabalho — o que foi feito, decisões tomadas, dados coletados, e o que ainda falta.
9. Toda mudança de arquitetura de acesso/autenticação/banco de dados deve ser confirmada com Pablo antes de implementar.
10. **Vídeos de execução são embed, nunca hospedagem própria.** O mapa `VIDEOS` (id do exercício → id do vídeo no YouTube) fica no `<script>` do HTML. São vídeos curtos de terceiros (YouTube Shorts, ≤60s) incorporados via `<iframe>` — nunca baixar/reidospedar o vídeo. Como é conteúdo de terceiros, o link pode sair do ar; revalidar o mapa periodicamente e avisar o Pablo se algum vídeo quebrar.
11. **Tema visual é laranja sobre fundo preto** (`--accent:#ff7a29`, `--bg:#0a0a0a`, ver variáveis CSS no `:root`). Texto sobre botão laranja usa `--on-accent` (escuro) pra manter contraste — nunca usar o texto claro padrão em cima do laranja.
12. **Mapa muscular (`renderMuscleMap()`) é 100% baseado em dados objetivos** (data do treino + séries marcadas OK) — nunca em interpretação de fadiga/RPE subjetivo. Isso é reforço direto da regra 5. O mapa `MUSCLE_MAP` associa cada `id` de exercício ao(s) grupamento(s) muscular(es) que ele trabalha; ao adicionar exercício novo ao `PLANO`, adicionar também a entrada correspondente em `MUSCLE_MAP` (ou deixar de fora de propósito, como o `c1`/caminhada, que é condicionamento e não força localizada). "Vermelho" no mapa é sempre `diasDesde === 0` (treinado HOJE) — nunca "sessão mais recente do histórico", porque isso deixaria um músculo vermelho pra sempre se a última sessão registrada for antiga.
13. **Testar mudanças que dependem de histórico de treino (mapa muscular, streak, semana) exige o stub *stateful* do Firestore** (`firebase-stub-stateful.js`, guarda os docs em memória e aceita `window.__SEED__` pra pré-popular sessões com datas arbitrárias). O `firebase-stub.js` simples sempre retorna `get()` vazio — serve só pra testar login/navegação/salvamento, não lógica que lê o histórico de volta.

## Metodologia de treino vigente (resumo — ver MEMORY.md para a pesquisa completa)
- Estrutura full-body/upper-lower (não bro-split), batendo cada grupamento ≥2x/semana mesmo com só 2-3 sessões/semana.
- Volume-alvo: 12-20 séries/grupamento/semana.
- Progressão dupla com RIR/RPE autorregulado (Bloco 0: RIR 3-4 · Bloco 1: RIR 1-3).
- Blocos: Bloco 0 (semanas 1-2, fundação/readaptação conservadora) → Bloco 1 (semanas 3-10, acumulação de força/hipertrofia + base aeróbica) → Bloco 2 (condicionamento específico de tênis: agilidade, potência, RSA).
- Treino concorrente (força + cardio) não tem interferência relevante em força/hipertrofia — sem medo de combinar na mesma semana; único cuidado real é sequenciar potência antes de força pesada.
- Condicionamento geral: intervalos longos (≥2min de esforço, ≥15min de volume total) rendem mais VO2max por minuto investido do que HIIT curtíssimo.
- Nutrição: déficit moderado (10-15%, nunca >25%), proteína 1,6-2,2g/kg/dia distribuída em ~4 refeições.
- Disponibilidade real do Pablo é amarrada ao calendário de internato (Folga normal e CC2/CC3 = dia de treino completo; PS Diurno, CC1 e Folga pós-plantão = sem treino de academia). Terças e quintas têm treino de xadrez das 20h30-22h (não está no Google Calendar do Pablo e não deve ser adicionado lá) — sessão de treino precisa terminar com folga antes disso nesses dias.

## Formato/estilo
- Tom: direto, orientado a dados reais, sem embelezar números.
- Sempre que possível, deixar claro se um dado é medido, estimado ou interpretação (ex: FC do Apple Watch é medida; TDEE calculado por fórmula é estimativa).
