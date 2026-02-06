---
name: "ui-ux-pro-max"
description: "Provides design intelligence for professional UI/UX across platforms. Invoke when building or refining user interfaces, creating design systems, or improving visual design."
---

# UI UX Pro Max

An AI skill that provides design intelligence for building professional UI/UX across multiple platforms and frameworks.

## Core Capabilities

### 1. Intelligent Design System Generation
Analyzes project requirements and generates a complete, tailored design system including:
- **Visual Patterns**: Hero-centric, social proof, etc.
- **Style Direction**: Soft UI, minimal, professional, etc.
- **Color Palettes**: Primary, secondary, CTA, and background colors with hex codes.
- **Typography**: Recommended Google Fonts with mood descriptions.
- **Key Effects**: Shadow styles, transitions, and hover states.

### 2. Design Reasoning
Provides justification for design choices based on user experience principles, conversion optimization, and brand identity.

### 3. Anti-pattern Avoidance
Helps avoid common design mistakes such as:
- Harsh animations
- Poor color contrast
- Overuse of gradients
- Non-standard iconography (recommends SVG libraries like Heroicons/Lucide)

## Best Practices & Checklist

- **Accessibility**: Minimum WCAG AA contrast, visible focus states, and respecting `prefers-reduced-motion`.
- **Interactions**: Smooth transitions (150-300ms) and clear hover states.
- **Responsiveness**: Support for 375px, 768px, 1024px, and 1440px breakpoints.
- **Clickable Elements**: Ensure `cursor: pointer` is applied to all interactive components.

## When to Invoke
Invoke this skill when:
- Starting a new UI component or page.
- Redesigning existing interfaces.
- Defining a brand's visual identity in the codebase.
- Reviewing UI code for design consistency and quality.
