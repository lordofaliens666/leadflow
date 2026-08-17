// Shared render engine — the ONE code path used by both the Pre-publish
// Simulator (dashboard, one iframe per synthetic device profile) and the
// Client SDK (test-client). Neither caller re-implements rendering or the
// fallback decision; they only supply a screen schema + a device's
// supportedTypes and call renderScreen().
//
// Screen schema shape:
//   { id, title, version, components: ComponentNode[], fallback: ComponentNode[] }
// ComponentNode shape:
//   { id, type, props }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const COMPONENT_REGISTRY = {
  banner(props) {
    const wrap = el('div', `comp comp-banner tone-${props.tone || 'default'}`);
    wrap.appendChild(el('div', 'banner-title', props.title || ''));
    wrap.appendChild(el('div', 'banner-subtitle', props.subtitle || ''));
    return wrap;
  },
  heading(props) {
    return el('h2', 'comp comp-heading', props.text || '');
  },
  text(props) {
    return el('p', 'comp comp-text', props.text || '');
  },
  image(props) {
    const wrap = el('div', 'comp comp-image');
    wrap.appendChild(el('span', 'image-label', props.label || 'image'));
    return wrap;
  },
  button(props) {
    return el('button', `comp comp-button style-${props.style || 'primary'}`, props.text || 'Button');
  },
  spacer(props) {
    const wrap = el('div', 'comp comp-spacer');
    wrap.style.height = `${props.height || 16}px`;
    return wrap;
  },
  'carousel-v2': function carouselV2(props) {
    const wrap = el('div', 'comp comp-carousel');
    (props.items || []).forEach((item) => {
      const card = el('div', 'carousel-card');
      card.appendChild(el('div', 'carousel-item-label', item.label || ''));
      card.appendChild(el('div', 'carousel-item-price', item.price || ''));
      wrap.appendChild(card);
    });
    return wrap;
  },
};

export function requiredTypes(schema) {
  return Array.from(new Set((schema.components || []).map((c) => c.type)));
}

export function missingTypes(schema, supportedTypes) {
  const supported = new Set(supportedTypes || []);
  return requiredTypes(schema).filter((t) => !supported.has(t));
}

// Renders `schema` into `container` using only the component types listed in
// `supportedTypes`. If any required type is unsupported, the whole screen
// falls back to schema.fallback (the cached fallback layout) instead of a
// partial/broken render — mirrors the client SDK's local fallback behavior.
export function renderScreen(container, schema, supportedTypes) {
  container.innerHTML = '';
  const missing = missingTypes(schema, supportedTypes);
  const useFallback = missing.length > 0;
  const nodes = useFallback ? schema.fallback || [] : schema.components || [];

  nodes.forEach((node) => {
    const render = COMPONENT_REGISTRY[node.type];
    if (render) container.appendChild(render(node.props || {}));
  });

  if (nodes.length === 0) {
    container.appendChild(el('p', 'empty-state', 'Nothing to render.'));
  }

  return { useFallback, missingTypes: missing, requiredTypes: requiredTypes(schema) };
}
