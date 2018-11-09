# VJ (Vanilla Javascript)

VJ is a 0 dependency, react-like light framework for creating simple web components.

---

### Example

Register a component with an initial state object and a render function:
```javascript
  VJ.register('comment', {
    comments: ['a', 'b', 'c'],
  }, (attributes, state) => {
    const handleClick = () => {
      console.log('posting a comment');
      state.update({ comments: [...state.comments, attributes.references.input.value] });
    };

    return [
      ['div', { class: 'comment' }, [
        ['input', { placeholder: 'Write a comment...', ref: 'input' }],
        ['button', { click: handleClick }, 'Post'],
        ...state.comments.map(x => ['p', x]),
      ]]
    ];
  });
```

Create a placeholder in HTML to be replaced by the component:
```html
<ins type="comment"></ins>
```

The loaded page will output:
```html
<div class="comment" component="0">
  <input placeholder="Write a comment...">
  <button>Post</button>
  <p>a</p>
  <p>b</p>
  <p>c</p>
</div>
```

### Features

- Custom web components
- Nested components
- Attributes & State
- DOM references
- Event handling