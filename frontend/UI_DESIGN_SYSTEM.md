# Estimate AI - UI Design System

> A modern, Gen-Z inspired design system for enterprise applications.  
> Last updated: February 2026

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Components](#components)
6. [Animations](#animations)
7. [Layout Patterns](#layout-patterns)

---

## Design Philosophy

### Core Principles

1. **No Boxes** - Avoid visible borders and boxy card layouts. Use subtle backgrounds and shadows for depth.
2. **Typography First** - Let text hierarchy do the heavy lifting, not containers.
3. **Motion is Meaning** - Every interaction should have purposeful animation.
4. **Breathing Room** - Generous spacing creates a premium, uncluttered feel.
5. **Subtle Depth** - Use shadows and gradients instead of borders for separation.

### What We Avoid

- Hard borders on form inputs
- Boxed card layouts with visible boundaries
- Static, lifeless interactions
- Cramped spacing
- Flat, single-color buttons

### What We Embrace

- Floating elements with soft shadows
- Gradient accents on primary actions
- Micro-animations on every interaction
- Generous whitespace
- Typography-driven visual hierarchy

---

## Color Palette

### Primary Colors (Blue)

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary 50 | `#EFF6FF` | 239, 246, 255 | Subtle backgrounds, hover states |
| Primary 100 | `#DBEAFE` | 219, 234, 254 | Light accents, selected states |
| Primary 200 | `#BFDBFE` | 191, 219, 254 | Borders on focus |
| Primary 300 | `#93C5FD` | 147, 197, 253 | Icons, secondary elements |
| Primary 400 | `#60A5FA` | 96, 165, 250 | Hover states, links |
| **Primary 500** | `#3B82F6` | 59, 130, 246 | **Primary brand color** |
| Primary 600 | `#2563EB` | 37, 99, 235 | Primary buttons, CTAs |
| Primary 700 | `#1D4ED8` | 29, 78, 216 | Gradient end, pressed states |
| Primary 800 | `#1E40AF` | 30, 64, 175 | Dark accents |
| Primary 900 | `#1E3A8A` | 30, 58, 138 | Text on light backgrounds |

### Neutral Colors (Grey Scale)

| Name | Hex | Usage |
|------|-----|-------|
| White | `#FFFFFF` | Backgrounds, cards |
| Off-White | `#F8FAFC` | Page backgrounds, subtle contrast |
| Slate 100 | `#F1F5F9` | Input backgrounds, hover states |
| Slate 200 | `#E2E8F0` | Dividers, subtle borders |
| Slate 300 | `#CBD5E1` | Disabled states, placeholders |
| Slate 400 | `#94A3B8` | Secondary text, icons |
| Slate 500 | `#64748B` | Body text (secondary) |
| Slate 600 | `#475569` | Body text |
| Slate 700 | `#334155` | Headings |
| Slate 800 | `#1E293B` | Primary text |
| Slate 900 | `#0F172A` | High-emphasis text |

### Semantic Colors

| Purpose | Light | Default | Dark |
|---------|-------|---------|------|
| Success | `#DCFCE7` | `#22C55E` | `#15803D` |
| Warning | `#FEF3C7` | `#F59E0B` | `#B45309` |
| Error | `#FEE2E2` | `#EF4444` | `#B91C1C` |
| Info | `#DBEAFE` | `#3B82F6` | `#1D4ED8` |

### Gradients

```css
/* Primary Button Gradient */
--gradient-primary: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);

/* Accent Glow (for hover effects) */
--gradient-glow: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);

/* Subtle Background */
--gradient-subtle: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);

/* Glass Effect Background */
--gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%);
```

---

## Typography

### Font Family

```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 48px / 3rem | 700 | 1.1 | Hero sections |
| H1 | 36px / 2.25rem | 700 | 1.2 | Page titles |
| H2 | 28px / 1.75rem | 600 | 1.25 | Section headers |
| H3 | 22px / 1.375rem | 600 | 1.3 | Card titles |
| H4 | 18px / 1.125rem | 600 | 1.4 | Subsections |
| Body Large | 18px / 1.125rem | 400 | 1.6 | Lead paragraphs |
| Body | 15px / 0.9375rem | 400 | 1.6 | Default text |
| Body Small | 14px / 0.875rem | 400 | 1.5 | Secondary text |
| Caption | 12px / 0.75rem | 500 | 1.4 | Labels, hints |
| Overline | 11px / 0.6875rem | 700 | 1.4 | Category labels |

### Letter Spacing

| Type | Value |
|------|-------|
| Tight (headings) | `-0.02em` |
| Normal | `0` |
| Wide (overlines) | `0.1em` |

---

## Spacing

### Base Unit

All spacing is based on a 4px grid system.

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Tight gaps |
| space-2 | 8px | Icon gaps, inline spacing |
| space-3 | 12px | Small gaps |
| space-4 | 16px | Default gaps |
| space-5 | 20px | Medium gaps |
| space-6 | 24px | Section spacing |
| space-8 | 32px | Large gaps |
| space-10 | 40px | Section margins |
| space-12 | 48px | Page sections |
| space-16 | 64px | Major sections |

### Component Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Button (default) | 12px 24px | - |
| Button (large) | 16px 32px | - |
| Input | 14px 16px | - |
| Card | 24px | 16px |
| Form fields | - | 24px |
| Page sections | - | 48px |

---

## Components

### Buttons

#### Primary Button (Gradient)
```css
background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
color: white;
padding: 12px 24px;
border-radius: 9999px; /* pill shape */
font-weight: 600;
box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
transition: all 200ms ease-out;

/* Hover */
transform: translateY(-1px);
box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
```

#### Secondary Button
```css
background: #F1F5F9;
color: #334155;
padding: 12px 24px;
border-radius: 9999px;
font-weight: 500;
transition: all 200ms ease-out;

/* Hover */
background: #E2E8F0;
```

#### Ghost Button
```css
background: transparent;
color: #475569;
padding: 12px 24px;
border-radius: 9999px;
font-weight: 500;
transition: all 200ms ease-out;

/* Hover */
background: #F8FAFC;
```

### Form Inputs

#### Text Input (Borderless)
```css
background: #F8FAFC;
color: #1E293B;
padding: 14px 16px;
border-radius: 12px;
border: 2px solid transparent;
font-size: 15px;
transition: all 200ms ease-out;

/* Focus */
background: #FFFFFF;
border-color: #3B82F6;
box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);

/* Placeholder */
color: #94A3B8;
```

#### Textarea
Same as text input, with:
```css
min-height: 120px;
resize: none;
```

#### Select Trigger
Same as text input, with dropdown icon.

### Cards (Floating Style)

```css
background: #FFFFFF;
border-radius: 16px;
padding: 24px;
box-shadow: 
  0 1px 3px rgba(0, 0, 0, 0.04),
  0 6px 16px rgba(0, 0, 0, 0.04);
/* NO border */

/* Hover (if interactive) */
box-shadow: 
  0 2px 4px rgba(0, 0, 0, 0.04),
  0 8px 24px rgba(0, 0, 0, 0.06);
transform: translateY(-2px);
```

### Badges

```css
display: inline-flex;
padding: 4px 12px;
border-radius: 9999px;
font-size: 12px;
font-weight: 600;
background: #EFF6FF;
color: #1D4ED8;
```

---

## Animations

### Timing Functions

| Name | Value | Usage |
|------|-------|-------|
| ease-out | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Enter animations |
| ease-in | `cubic-bezier(0.4, 0.0, 1, 1)` | Exit animations |
| ease-in-out | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Transitions |
| spring | `type: "spring", stiffness: 400, damping: 30` | Bouncy interactions |

### Durations

| Name | Value | Usage |
|------|-------|-------|
| instant | 100ms | Micro-interactions |
| fast | 150ms | Hover states |
| normal | 200ms | Default transitions |
| slow | 300ms | Page transitions |
| slower | 400ms | Complex animations |

### Common Animations (Framer Motion)

#### Fade In Up
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: "easeOut" }}
```

#### Scale In
```tsx
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ duration: 0.2, ease: "easeOut" }}
```

#### Stagger Children
```tsx
// Parent
variants={{
  show: { transition: { staggerChildren: 0.05 } }
}}

// Children
variants={{
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}}
```

#### Button Hover
```tsx
whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(59, 130, 246, 0.35)" }}
whileTap={{ scale: 0.98 }}
```

---

## Layout Patterns

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content (flex-1)          │
│                  │                                  │
│ Navigation       │  Page Header (typography)        │
│ - Item           │  ────────────────────────────   │
│ - Item           │                                  │
│ - Item           │  Content Area                    │
│                  │  (generous padding: 48px)        │
│                  │                                  │
│                  │                                  │
└─────────────────────────────────────────────────────┘
```

### Form Layout (Two Column)

```
Header Title (H1)
Subtitle text (muted)

┌─ Left Column (40%) ─┐  ┌─ Right Column (60%) ─────┐
│                     │  │                          │
│ Contextual info     │  │ Form fields              │
│ Steps/Progress      │  │ (stacked, generous gap)  │
│ Help text           │  │                          │
│                     │  │ [Primary Action Button]  │
└─────────────────────┘  └──────────────────────────┘
```

### List Layout

```
Search/Filter Bar
────────────────────────────────────────

┌─ List Item ───────────────────────────┐
│ Icon  Title                   Action  │
│       Subtitle/Meta                   │
└───────────────────────────────────────┘
      ↑ 8px gap between items
┌─ List Item ───────────────────────────┐
│ Icon  Title                   Action  │
│       Subtitle/Meta                   │
└───────────────────────────────────────┘
```

---

## Implementation Notes

### Tailwind Classes Reference

```tsx
// Primary Button
"bg-gradient-to-br from-blue-500 to-blue-700 text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"

// Secondary Button
"bg-slate-100 text-slate-700 px-6 py-3 rounded-full font-medium hover:bg-slate-200 transition-all duration-200"

// Input Field
"w-full bg-slate-50 text-slate-800 px-4 py-3.5 rounded-xl border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200 placeholder:text-slate-400"

// Card (Floating)
"bg-white rounded-2xl p-6 shadow-sm shadow-slate-200/50 hover:shadow-md hover:shadow-slate-200/60 transition-all duration-200"
```

### File Structure

```
src/
├── index.css           # Design tokens only
├── components/
│   └── ui/
│       ├── Button.tsx  # Tailwind + Framer Motion
│       ├── Input.tsx   # Borderless design
│       ├── Select.tsx  # Animated dropdown
│       └── ...
└── pages/
    └── *.tsx           # No CSS imports, Tailwind only
```

---

## Quick Reference Card

| Element | Key Styles |
|---------|-----------|
| Primary Button | `gradient` `rounded-full` `shadow-lg` |
| Input | `bg-slate-50` `border-transparent` `rounded-xl` |
| Card | `bg-white` `rounded-2xl` `shadow-sm` `no border` |
| Page Padding | `px-6` `py-8` or larger |
| Form Gap | `space-y-6` |
| Heading | `text-slate-900` `font-bold` `tracking-tight` |
| Body Text | `text-slate-600` `leading-relaxed` |
| Muted Text | `text-slate-400` `text-sm` |

---

*This design system is inspired by Linear, Vercel, and modern Gen-Z enterprise applications.*
