# Dossier — Visor de evidencia de chats de WhatsApp

Scaffold inicial para Google Antigravity. Procesa exportaciones largas
(.txt + .zip) de WhatsApp completamente en el cliente (sin backend),
para ser presentadas como respaldo o evidencia visual ordenada.

## Stack

- **SvelteKit** (TypeScript) — `adapter-static`, todo corre en el cliente.
- **CSS Modules nativo + variables CSS** — sin Tailwind. Ver `src/lib/styles/tokens.css`.
- **GSAP** — stagger de entrada de mensajes, zoom de adjuntos, pulso de confirmación al soltar archivos.
- **Three.js** — campo de partículas ambiental con parallax de cursor (`src/lib/three/ParticleField.ts`).
- **lucide-svelte** — iconografía.

## Por qué se ve así (y no "IA genérica")

El tema visual **no es un cyberpunk de fondo negro + acento neón** (el
default número dos que produce cualquier IA cuando le piden "dark mode +
glassmorphism"). El concepto es **"Dossier"**: un expediente forense
digital.

- **Paleta**: `#0a0a0c` + **latón** `#c89b5c` (sello / evidencia activa)
  + **acero** `#6e9aab` (verificación, hashes, metadatos, burbujas propias).
- **Tipografía**: Space Grotesk (display) + IBM Plex Sans (cuerpo) +
  **IBM Plex Mono** para timestamps y hashes — como una bitácora de
  cadena de custodia real.
- **Elemento firma**: `.evidence-frame` — brackets de esquina (como una
  etiqueta fotográfica forense) en vez de bordes redondeados genéricos.
  Se usa en adjuntos y en la zona de carga.
- **Textura**: grano de fondo sutil (`background-image` con puntos a
  2.5% de opacidad) para romper la planitud "flat" típica.

Toda esta lógica vive en `src/lib/styles/tokens.css` y `global.css`; si
quieres cambiar el rumbo visual, ese es el único lugar que hay que tocar.

## Estructura

```
src/
├── app.html                     # fuentes tipográficas, meta theme-color
├── lib/
│   ├── types/chat.types.ts      # modelo de dominio del parser (mensajes, adjuntos, casos)
│   ├── styles/
│   │   ├── tokens.css           # sistema de diseño "Dossier"
│   │   └── global.css           # reset, .glass-panel, .evidence-frame, .ledger-label
│   ├── three/ParticleField.ts   # fondo ambiental Three.js
│   └── components/
│       ├── ThreeBackground.svelte
│       ├── ProjectSidebar.svelte   # columna izquierda: casos guardados
│       ├── ChatFeed.svelte         # columna central: feed + buscador global
│       ├── MessageBubble.svelte    # burbuja individual (imagen/video/audio/texto)
│       ├── TimelinePanel.svelte    # columna derecha: año/mes/día + export PDF
│       └── DropZone.svelte         # carga drag-and-drop de .txt / .zip
└── routes/
    ├── +layout.svelte
    └── +page.svelte             # ensambla el grid de 3 columnas
```

## Pendiente de implementación (siguiente iteración)

Este scaffold entrega la **estructura, los tipos y la maquetación**
pedidos. Aún faltan, intencionalmente fuera de este alcance:

1. `whatsappParser.ts` — el motor real que lee el `.txt` línea a línea,
   normaliza fecha/hora según `ParserOptions` y produce un `ParsedChat`
   (los tipos ya están listos en `chat.types.ts`).
2. Extracción del `.zip` (con `jszip`, ya en `package.json`) y
   vinculación de adjuntos por nombre de archivo / timestamp.
3. Generación del PDF paginado con marca de agua (con `jspdf`, ya en
   `package.json`) desde el botón "Generar reporte PDF".
4. Exportación de carpetas estructuradas por fecha al sistema de
   archivos local (File System Access API).

## Instalación

```bash
npm install
npm run dev
```
