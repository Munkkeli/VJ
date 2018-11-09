/**
 * VJ, or Vanilla Javascript is a 0 dependency,
 * react-like light framework for creating simple web components
 * 
 * (c) Tuomas Pöyry 2018 <tuomas@munkkeli.io>
 */
const VJ = (() => {
  const registeredComponents = {};
  const activeComponents = {};
  
  let activeComponentIndex = 0;

  /**
   * Create a new DOM node
   * @param {string} element Type of the dom node
   * @param {Object.<string, string | number | function>} attributes DOM attributes of the node
   * @param {HTMLElement[] | string | number} children Child DOM elements of the node
   */
  const create = (element, attributes, children) => {
    // If element is a custom component
    if (registeredComponents[element]) {
      const node = document.createElement('ins');
      node.setAttribute('type', element);
      return { component: element, node, attributes, children };
    }

    // Create the DOM node
    const node = document.createElement(element);

    // Set event listener
    const setEventListener = (event, action) => {
      node.addEventListener(event, action);
    };

    // Set node attributes
    for (const attribute in attributes) {
      if (attribute === 'ref') continue;

      // Check if attribute is an event listener
      if (typeof(attributes[attribute]) === 'function') {
        setEventListener(attribute, attributes[attribute]);
        continue;
      }
  
      node.setAttribute(attribute, attributes[attribute]);
    }

    // Check if children are DOM nodes or just text
    if (Array.isArray(children)) {
      // Append all children
      for (const child of children) {
        node.appendChild(child);
      }
    } else {
      // Set text content
      node.innerText = `${children}`;
    }

    // Return the fully configured node
    return node;
  };

  const register = (component, state, render) => {
    if (registeredComponents[component]) throw new Error('Component with that name already exists');
    registeredComponents[component] = { state, render };
  }

  /**
   * Creates a new instance of a component
   * @param {string} component Type of the component
   * @param {HTMLElement} node The DOM node to replace with the component
   * @param {Object.<string, *>} attributes Attributes of the component
   * @param {boolean} child If component is a child of another component, if true, will not update component immediately
   * @returns {Component}
   */
  const initialize = (component, node, attributes, child = false) => {
    // Check if a component with the given type has been registered
    if (!registeredComponents[component]) throw new Error(`Component "${component}" does not exist`);

    // Create the component
    const active = {
      id: activeComponentIndex++,
      key: attributes.key,
      node,
      type: component,
      children: [],
      state: null,
      attributes: {...attributes},
      render: registeredComponents[component].render,
      hasRendered: false,
      inUse: true,
    };

    // Create a state object
    const state = {
      _document: { ...registeredComponents[component].state },
      _references: {},
    };

    // Create a funktion to mutate the state
    const setState = (document) => {
      state._document = { ...state._document, ...document };
      update(active);
    };

    // Assign values
    state.set = setState;
    active.state = state;
    activeComponents[active.id] = active;

    // If child is set to true, skip update
    if (!child) update(active);

    return active;
  }

  /**
   * Renders a initialized component into DOM nodes
   * @param {[[string, Object.<string, string | number>, HTMLElement[] | string | number]]} output
   * @returns {null | HTMLElement[] | HTMLElement}
   */
  const render = (output, component) => {
    const result = [];

    // Loop through the VJ DOM
    for (const element of output) {
      // If only type of element is given
      if (element.length === 1) {
        result.push(create(element[0], {}, ''));

      // If the type and attributes or children are given
      } else if (element.length === 2) {
        let children = '';
        let attributes = {};

        if (typeof element[1] === 'object' && !Array.isArray(element[1])) {
          attributes = element[1];
        } else {
          if (Array.isArray(element[1])) {
            children = render(element[1], component);
            children = Array.isArray(children) ? children : [children];
          } else {
            children = element[1];
          }
        }

        const node = create(element[0], attributes, children);
        if (attributes.ref) component.state._references[attributes.ref] = node;
        result.push(node);

      // If type, attributes and children are given
      } else {
        let children = '';
        if (Array.isArray(element[2])) {
          children = render(element[2], component);
          children = Array.isArray(children) ? children : [children];
        } else {
          children = element[2];
        }

        const node = create(element[0], element[1], children);
        if (element[1].ref) component.state._references[element[1].ref] = node;
        result.push(node);
      }
    }

    // Register any child components to the parent component
    for (const index in result) {
      const element = result[index];
      if (element.component && element.node) {
        // Check if an existing child can be reused
        const match = component.children.find(x => x.hasRendered && !x.inUse && x.type === element.component && x.key === element.attributes.key);
        if (match) {
          match.inUse = true;
          result[index] = match.node;
        } else {
          const child = initialize(element.component, element.node, element.attributes, true);
          component.children.push(child);
          result[index] = child.node;
        }
      }
    }

    // Return null if nothing was rendered, one element if just one was returned, or the array if many were returned
    if (!result.length) {
      return null;
    } else if (result.length === 1) {
      return result[0];
    } else {
      return result;
    }
  }

  /**
   * Renders an instance of a component, and all its child components
   * @param {Component} component The instance to update
   */
  const update = (component) => {
    // Create a detached object for attributes with references
    const attributes = {
      ...component.attributes,
      get references() { return component.state._references; },
    };

    // Render the VJ DOM for the component
    const output = component.render(attributes, { ...component.state._document, update: component.state.set });

    // Mark all child component as inactive (Will be marked as active if needed)
    for (const child of component.children) {
      child.inUse = false;
    }

    // Clear references to child DOM nodes
    component.state._references = {};

    // Build the actual DOM for the component
    const node = render(output, component);
    node.setAttribute('component', component.id);

    // Render required child component, dispose the others
    for (const child of component.children) {
      if (child.inUse) {
        update(child);
      } else {
        remove(child);
      }
    }

    // Remove references to removed child components
    component.children = component.children.filter(x => x.inUse);

    // Replace the old DOM node with the newly rendered one
    component.node.parentNode.replaceChild(node, component.node);
    component.node = node;
    component.hasRendered = true;

    console.log('Updated component', component.type, component.id);
  }

  /**
   * Removes an instance of a component
   * @param {Component} component The instance of the component to be removed
   */
  const remove = (component) => {
    // Remove the DOM node of the component
    component.node.parentNode.removeChild(component.node);

    // Remove the component from active component list
    delete activeComponents[component.id];
  };

  // When DOM is build, replace component placehilders with actual components
  document.addEventListener('DOMContentLoaded', () => {
    const list = document.querySelectorAll('ins[type]');
    for (const element of list) {
      const type = element.getAttribute('type');
      const attributes = {};
      for (const node of element.attributes) {
        if (node.nodeName === 'type') continue;
        if (node.nodeName === 'key') continue;
        attributes[node.nodeName] = node.nodeValue;
      }
      initialize(type, element, attributes);
    }
  });

  return {
    register,
  };
})();

window.VJ = VJ;