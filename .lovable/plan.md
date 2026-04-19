

## Header ainda mais iOS/macOS

Para evoluir o header para um padrão mais próximo de **macOS Big Sur/Sonoma e iOS Control Center**, vou aplicar:

### 1. **Pill flutuante (floating island)**
Em vez de ocupar toda a largura, o header vira uma **pílula centralizada** com margem do topo (estilo macOS Dock + Dynamic Island do iOS). Bordas bem arredondadas (`rounded-full` ou `rounded-2xl`).

### 2. **Glassmorphism mais intenso e refinado**
- `backdrop-blur-2xl` + `backdrop-saturate-200` (vibrancy do macOS)
- Background com gradiente sutil: `bg-gradient-to-b from-white/[0.08] to-white/[0.04]`
- Borda dupla: borda externa escura + highlight interno (`inset 0 1px 0 white/10`) para simular o "shine" do vidro macOS
- Sombra ambient + key light (já temos `shadow-ios-lg`)

### 3. **Indicador ativo estilo macOS Dock**
Item ativo ganha um pill background sutil (`bg-white/10`) com **dot indicator** abaixo (como o indicador de app aberto no Dock).

### 4. **Tipografia SF-like**
- `tracking-tight` mais agressivo
- Peso `font-medium` (500) — SF Pro usa 500 para nav
- Tamanho `text-[13px]` mantido
- Font feature settings: `font-feature-settings: "ss01", "cv11"` (já em SF Pro)

### 5. **Hover com spring-feel**
- `transition-[background,transform] duration-200 ease-ios`
- Hover: `bg-white/[0.06]` + leve `scale-[1.02]` no item

### 6. **Dropdowns como popovers iOS**
- `rounded-2xl` (ao invés de `rounded-lg`)
- Padding interno maior, items com mais respiro
- Separadores sutis entre grupos
- Animação `slide-in-from-top-2` + `zoom-in-95` (já temos)
- Backdrop-blur idêntico ao header

### 7. **Logo + chip de contexto**
À esquerda da pílula, logo da V4. Pode ter um separador vertical sutil (`w-px h-4 bg-white/10`) entre logo e nav.

### 8. **Botão "Sair" como ícone-only**
Estilo macOS menubar: só o ícone `LogOut` num botão circular `rounded-full p-1.5`, com tooltip ao hover. Mais limpo, menos texto.

### Mudanças de arquivo

**`src/components/V4Header.tsx`** (única alteração):
- Wrapper externo: `<header className="fixed top-3 left-1/2 -translate-x-1/2 z-40 ...">`
- Conteúdo num container `rounded-full` ou `rounded-2xl` com glass
- Adicionar `padding-top` no body/main para compensar (ou usar `sticky top-3` num wrapper).
- Indicador ativo com dot.
- Botão sair só ícone com tooltip.
- Mobile: manter sidebar atual mas com glass mais forte e `rounded-2xl` no overlay.

### Cuidados
- Manter contraste AA (texto sobre vidro escuro).
- Testar com scroll: o glass deve ficar mais opaco quando há conteúdo atrás (já temos lógica `scrolled`).
- Mobile: a pílula vira full-width com margem lateral pequena (`mx-3`) para preservar a estética.

