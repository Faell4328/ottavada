import type { ScoreRow, Version, MenuSection, StatusItem } from "../types";

export const libraryRows: ScoreRow[] = [
  {
    title: "Canon in D",
    author: "",
    modified: "Hoje 15:21",
    expanded: true,
    children: [
      { title: "Violino 1", author: "", modified: "Hoje 15:21" },
      { title: "Violino 2", author: "", modified: "Violino 1" },
      { title: "Viola", author: "", modified: "Violino 2" },
      { title: "Violoncelo", author: "", modified: "Violoncelo" },
      { title: "Órgão", author: "", modified: "Órgão" },
    ],
  },
  {
    title: "Moonlight Sonata",
    author: "L. van Beethoven",
    modified: "Ontem 18:43",
  },
  { title: "Bossa Nova Groove", author: "A. Silva", modified: "20/04/2024" },
  {
    title: "Ode to Joy",
    author: "L. Beethoven / Arr. M. Sousa",
    modified: "18/04/2024",
  },
  { title: "Jazz Etude", author: "H. Costa", modified: "17/04/2024" },
];

export const versions: Version[] = [
  { name: "Versão Atual", detail: "Hoje 15:21", tone: "active" },
  {
    name: "Rascunho - Edição em andamento",
    detail: "Hoje 14:50",
    tone: "draft",
  },
  { name: "V2 - Nova Introdução", detail: "10/04/2024", tone: "ok" },
  { name: "V1 - Versão Inicial", detail: "05/03/2024", tone: "info" },
];

export const menuSections: MenuSection[] = [
  {
    title: "Biblioteca",
    items: [
      { label: "Todas as Partituras", icon: "★", active: true },
      { label: "Favoritos", icon: "♥" },
      { label: "Rascunhos Ativos", icon: "■" },
      { label: "Arquivos Compactados", icon: "S" },
    ],
  },
  {
    title: "Backups",
    items: [
      { label: "Backup Local", icon: "✓", active: true },
      { label: "Sincronizar com Google Drive", icon: "☁" },
    ],
  },
];

export const statusItems: StatusItem[] = [
  { icon: "✓", label: "Backup Automático:", highlight: true },
  { icon: "▮", label: "USB Drive Conectado" },
  { icon: "☁", label: "Sincronizado com Google Drive" },
];
