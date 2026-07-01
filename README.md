<p align="center">
  <img src="public/icon.png" width="100">
</p>

O **Score Maestro** é um software gratuito para Windows 10 e 11 (x32 e x64), desenvolvido com Tauri e React (aplicativo desktop) para facilitar o dia a dia de músicos e regentes no gerenciamento de músicas e partituras. Seu principal objetivo é resolver desafios comuns relacionados à localização, organização, sincronização e distribuição de repertórios.

É importante destacar que o **Score Maestro** não é uma ferramenta de criação, edição ou leitura de partituras. Ele atua como um intermediário e facilitador, integrando e organizando o fluxo de trabalho já existente.

Foi projetado para funcionar em conjunto com ferramentas amplamente utilizadas na criação e edição de partituras, como **Finale**, **MuseScore**, **Sibelius**, **Dorico** e **Encore**, além de outros programas compatíveis com formatos como **MusicXML**, **MIDI** e **PDF**.

Dessa forma, o sistema se adapta ao fluxo de trabalho já estabelecido, permitindo que músicos e regentes continuem utilizando as ferramentas que já conhecem e preferem, sem necessidade de mudanças na rotina de trabalho.

---

# Filosofia do sistema

O **Score Maestro** adiciona músicas e partituras exclusivamente por meio de **indexação de diretórios**. O processo é simples: basta selecionar um diretório que contenha arquivos de partituras. A ferramenta lê esse conteúdo e o incorpora internamente. A partir daí, qualquer alteração feita nos arquivos dentro desse diretório — adições, modificações ou exclusões — é automaticamente refletida no Score Maestro.

Isso significa que a organização das músicas e partituras segue a estrutura de pastas definida por você. A ferramenta se adapta à sua forma de organização, e não o contrário.

O Score Maestro **não modifica a estrutura de diretórios nem renomeia arquivos existentes**. Os nomes de músicas e partituras definidos no sistema são utilizados apenas internamente para organização e identificação, não afetando os nomes reais dos arquivos ou diretórios. A única operação que pode resultar em alteração direta no sistema de arquivos é a exclusão de músicas ou partituras, quando explicitamente solicitada pelo usuário.

Se um dia você decidir deixar de usar o Score Maestro, toda a sua estrutura de arquivos permanecerá exatamente como sempre esteve: organizada, acessível e familiar. O sistema trabalha sobre a organização já existente, sem impor formatos proprietários ou gerar dependências desnecessárias.

---

# Sobre a documentação

A documentação do projeto está em `docs/` e foi dividida em três seções:

- **Alto Nível** — visão geral do sistema: requisitos, funcionalidades, arquitetura.
- **Anotações** — diário de desenvolvimento e ideias.
- **Baixo Nível** — aspectos técnicos: ferramentas, modelagem, fluxos, decisões de implementação.

> Se esta é sua primeira vez lendo a documentação, comece pelo **Alto Nível** antes de ir para o **Baixo Nível**. Entenda o *porquê* antes do *como*. Também recomendo ler os arquivos segundo a ordem no nome das pastas e dos arquivos.

# 
